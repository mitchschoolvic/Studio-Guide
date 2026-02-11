import { useTracking } from '../../contexts/TrackingContext';
import { useConfig } from '../../contexts/ConfigContext';
import { useEffect, useRef, useCallback } from 'react';
import { GestureType, GestureIcons } from '../../types/schemas';
import RecordIcon from '../../assets/Record.png';
import StopIcon from '../../assets/Stop.png';

// Animation configuration
const ANIMATION_CONFIG = {
    // How fast the visual progress catches up to target (higher = faster)
    FORWARD_LERP_SPEED: 8,      // Speed when filling (following gesture progress)
    // Reverse animation timing
    REVERSE_PAUSE_DURATION: 300,  // Pause before reversing starts (ms)
    REVERSE_RAMP_DURATION: 600,   // Time to reach full reverse speed (ms)
    REVERSE_MIN_SPEED: 0.3,       // Starting speed multiplier (slow start)
    REVERSE_MAX_SPEED: 2.5,       // Maximum speed multiplier (accelerates to this)
    // Threshold for snapping to zero
    SNAP_TO_ZERO_THRESHOLD: 0.01,
    // Fade out duration after trigger completes (ms)
    COMPLETION_FADE_DURATION: 400,
} as const;

// Animation phases for clear state management
type AnimationPhase = 
    | 'idle'           // No animation, bar at 0
    | 'filling'        // Gesture detected, filling towards target
    | 'reversing'      // Gesture lost, reversing towards 0  
    | 'completed'      // Trigger fired, bar at 100%
    | 'fading';        // Post-completion fade out

// Animation state per trigger (kept outside React state for performance)
interface TriggerAnimState {
    phase: AnimationPhase;
    // The actual visual progress being displayed (0-1)
    displayProgress: number;
    // The target progress from gesture detection (0-1)
    targetProgress: number;
    // Timestamp for fade-out animation
    fadeStartTime: number | null;
    // Timestamp when reversing phase started (for pause + acceleration)
    reverseStartTime: number | null;
    // Last frame timestamp for delta time calculation
    lastFrameTime: number;
    // Last rendered values for dirty checking (avoid unnecessary DOM writes)
    lastRenderedScale: number;
    lastRenderedOpacity: number;
}

export function TriggerStatusPanel() {
    const { liveTriggers, livePendingTriggers } = useTracking();
    const { settings } = useConfig();

    // Refs to DOM elements for direct manipulation (bypass React render cycle)
    const barRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const stateRef = useRef<Map<string, TriggerAnimState>>(new Map());
    const rafRef = useRef<number>(0);
    
    // Stable refs to avoid recreating animation callback
    const liveTriggersRef = useRef(liveTriggers);
    const livePendingTriggersRef = useRef(livePendingTriggers);
    liveTriggersRef.current = liveTriggers;
    livePendingTriggersRef.current = livePendingTriggers;

    const triggers = [
        { id: 'start-rec', label: 'REC', gestureKey: 'startRecording' as keyof typeof settings.gestures },
        { id: 'stop-rec', label: 'STOP', gestureKey: 'stopRecording' as keyof typeof settings.gestures },
        { id: 'start-play', label: 'PLAY', gestureKey: 'startPlayback' as keyof typeof settings.gestures },
        { id: 'stop-play', label: 'STOP', gestureKey: 'stopPlayback' as keyof typeof settings.gestures },
    ];

    const visibleTriggers = triggers.filter(t => settings.gestureVisibility?.[t.gestureKey] ?? true);

    // Initialize state for each trigger
    useEffect(() => {
        const now = performance.now();
        visibleTriggers.forEach(t => {
            if (!stateRef.current.has(t.id)) {
                stateRef.current.set(t.id, {
                    phase: 'idle',
                    displayProgress: 0,
                    targetProgress: 0,
                    fadeStartTime: null,
                    reverseStartTime: null,
                    lastFrameTime: now,
                    lastRenderedScale: 0,
                    lastRenderedOpacity: 0,
                });
            }
        });
    }, [visibleTriggers]);

    // Animation loop using requestAnimationFrame for smooth 60fps
    const animate = useCallback(() => {
        const now = performance.now();
        const liveTriggers = liveTriggersRef.current;
        const livePendingTriggers = livePendingTriggersRef.current;
        const activeIds = new Set(liveTriggers?.current || []);
        const pendingMap = new Map<string, number>();

        (livePendingTriggers?.current || []).forEach(p => {
            pendingMap.set(p.id, p.progress);
        });

        stateRef.current.forEach((state, id) => {
            const bar = barRefs.current.get(id);
            if (!bar) return;

            // Calculate delta time for frame-rate independent animation
            const deltaTime = Math.min((now - state.lastFrameTime) / 1000, 0.1); // Cap at 100ms
            state.lastFrameTime = now;

            const isActive = activeIds.has(id);
            const isPending = pendingMap.has(id);
            const rawTargetProgress = pendingMap.get(id) ?? 0;

            // Update target progress
            state.targetProgress = rawTargetProgress;

            // Phase transition logic (state machine)
            const previousPhase = state.phase;
            state.phase = determinePhase(state, isActive, isPending);

            // Handle phase entry actions
            if (state.phase === 'completed' && previousPhase !== 'completed') {
                state.displayProgress = 1;
                state.reverseStartTime = null;
            }
            if (state.phase === 'fading' && previousPhase !== 'fading') {
                state.fadeStartTime = now;
            }
            if (state.phase === 'reversing' && previousPhase !== 'reversing') {
                state.reverseStartTime = now;
            }
            if (state.phase === 'filling' && previousPhase === 'reversing') {
                // Gesture resumed - clear reverse timing
                state.reverseStartTime = null;
            }
            if (state.phase === 'filling' && (previousPhase === 'idle' || previousPhase === 'fading' || previousPhase === 'completed')) {
                // Starting fresh - ensure displayProgress starts at 0
                state.displayProgress = 0;
                state.reverseStartTime = null;
            }
            if (state.phase === 'idle' && previousPhase !== 'idle') {
                state.displayProgress = 0;
                state.fadeStartTime = null;
                state.reverseStartTime = null;
            }

            // Calculate display values based on current phase
            let scale: number;
            let opacity: number;

            switch (state.phase) {
                case 'idle':
                    scale = 0;
                    opacity = 0;
                    break;

                case 'filling': {
                    // Apply ease-in-out curve: smooth start and end
                    // Display directly follows the eased target (no lerp layer needed)
                    state.displayProgress = easeInOutQuad(state.targetProgress);
                    
                    scale = state.displayProgress;
                    opacity = 0.3 + state.displayProgress * 0.7;
                    break;
                }

                case 'reversing': {
                    const reverseElapsed = now - (state.reverseStartTime ?? now);
                    
                    // Pause phase - hold position momentarily
                    if (reverseElapsed < ANIMATION_CONFIG.REVERSE_PAUSE_DURATION) {
                        // During pause, don't move
                        scale = state.displayProgress;
                        opacity = 0.3 + state.displayProgress * 0.4;
                        break;
                    }
                    
                    // Calculate acceleration ramp (ease-in: starts slow, speeds up)
                    const rampElapsed = reverseElapsed - ANIMATION_CONFIG.REVERSE_PAUSE_DURATION;
                    const rampProgress = Math.min(1, rampElapsed / ANIMATION_CONFIG.REVERSE_RAMP_DURATION);
                    
                    // Ease-in curve: slow start, accelerating
                    const easedRamp = easeInQuad(rampProgress);
                    
                    // Interpolate speed from min to max
                    const currentSpeed = ANIMATION_CONFIG.REVERSE_MIN_SPEED + 
                        (ANIMATION_CONFIG.REVERSE_MAX_SPEED - ANIMATION_CONFIG.REVERSE_MIN_SPEED) * easedRamp;
                    
                    // Apply the reverse movement
                    state.displayProgress = lerp(
                        state.displayProgress,
                        0,
                        currentSpeed * deltaTime
                    );
                    
                    // Snap to zero when close enough
                    if (state.displayProgress < ANIMATION_CONFIG.SNAP_TO_ZERO_THRESHOLD) {
                        state.displayProgress = 0;
                        state.phase = 'idle';
                        state.reverseStartTime = null;
                    }
                    
                    scale = state.displayProgress;
                    opacity = 0.3 + state.displayProgress * 0.4;
                    break;
                }

                case 'completed':
                    scale = 1;
                    opacity = 1;
                    break;

                case 'fading': {
                    const fadeElapsed = now - (state.fadeStartTime ?? now);
                    const fadeProgress = Math.min(1, fadeElapsed / ANIMATION_CONFIG.COMPLETION_FADE_DURATION);
                    
                    scale = 1;
                    opacity = 1 - easeOutCubic(fadeProgress);

                    if (fadeProgress >= 1) {
                        state.phase = 'idle';
                        state.displayProgress = 0;
                        state.fadeStartTime = null;
                        scale = 0;
                        opacity = 0;
                    }
                    break;
                }

                default:
                    scale = 0;
                    opacity = 0;
            }

            // Dirty check: only update DOM if values changed (reduces GPU work)
            const scaleChanged = Math.abs(scale - state.lastRenderedScale) > 0.001;
            const opacityChanged = Math.abs(opacity - state.lastRenderedOpacity) > 0.001;
            
            if (scaleChanged || opacityChanged) {
                // Use transform for GPU-accelerated animation (no layout recalc)
                bar.style.transform = `scaleX(${scale})`;
                bar.style.opacity = String(opacity);
                state.lastRenderedScale = scale;
                state.lastRenderedOpacity = opacity;
            }
        });

        rafRef.current = requestAnimationFrame(animate);
    }, []); // Empty deps - uses stable refs

    // Start/stop animation loop
    useEffect(() => {
        rafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafRef.current);
    }, [animate]);

    // Register bar ref
    const setBarRef = useCallback((id: string, el: HTMLDivElement | null) => {
        if (el) {
            barRefs.current.set(id, el);
        } else {
            barRefs.current.delete(id);
        }
    }, []);

    const count = visibleTriggers.length;
    let gridCols = '1fr 1fr';
    let gridRows = '1fr 1fr';
    if (count === 1) { gridCols = '1fr'; gridRows = '1fr'; }
    else if (count === 2) { gridCols = '1fr 1fr'; gridRows = '1fr'; }

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 15,
            padding: 0,
            background: '#1a1a1a',
        }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: gridCols,
                gridTemplateRows: gridRows,
                gap: 0,
                width: '100%',
                height: '100%',
                border: '1px solid #333'
            }}>
                {visibleTriggers.map((t, index) => {
                    const configuredGesture = settings.gestures?.[t.gestureKey] || GestureType.None;
                    const isDisabled = configuredGesture === GestureType.None;

                    // Dynamic borders
                    let borderLeft = 'none';
                    let borderTop = 'none';
                    const borderColor = '#444';
                    if (count === 4) {
                        if (index === 1 || index === 3) borderLeft = `1px solid ${borderColor}`;
                        if (index >= 2) borderTop = `1px solid ${borderColor}`;
                    } else if (count === 2 && index === 1) {
                        borderLeft = `1px solid ${borderColor}`;
                    } else if (count === 3) {
                        if (index === 1) borderLeft = `1px solid ${borderColor}`;
                        if (index === 2) borderTop = `1px solid ${borderColor}`;
                    }

                    const contentPadding = count <= 2 ? 40 : 10;
                    const iconSize = count <= 2 ? '40cqmin' : '45cqmin';

                    return (
                        <div key={t.id} style={{
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'space-evenly',
                            padding: contentPadding,
                            height: '100%',
                            boxSizing: 'border-box',
                            background: '#1a1a1a',
                            color: isDisabled ? '#444' : '#666',
                            borderRadius: 0,
                            boxShadow: 'none',
                            borderLeft,
                            borderTop,
                            borderRight: 'none',
                            borderBottom: 'none',
                            opacity: isDisabled ? 0.5 : 1,
                            containerType: 'size',
                            overflow: 'hidden',
                            gridColumn: (count === 3 && index === 2) ? '1 / -1' : 'auto',
                        }}>
                            {/* GPU-accelerated progress bar */}
                            <div
                                ref={(el) => setBarRef(t.id, el)}
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    bottom: 0,
                                    width: '100%',
                                    height: '100%',
                                    background: '#00ff88',
                                    opacity: 0,
                                    willChange: 'transform, opacity',
                                    transform: 'scaleX(0)',
                                    transformOrigin: 'left',
                                    zIndex: 0,
                                    pointerEvents: 'none',
                                }}
                            />

                            {/* Content */}
                            <span style={{
                                fontWeight: 'bold',
                                fontSize: '15cqmin',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 1,
                                position: 'relative',
                            }}>
                                {t.id === 'start-rec' ? (
                                    <img src={RecordIcon} alt="REC" style={{ height: '1.5em', width: 'auto' }} />
                                ) : t.id === 'stop-rec' ? (
                                    <img src={StopIcon} alt="STOP" style={{ height: '1.5em', width: 'auto' }} />
                                ) : (
                                    t.label
                                )}
                            </span>

                            <span style={{
                                width: '100%',
                                textAlign: 'center',
                                marginTop: 0,
                                opacity: 0.7,
                                zIndex: 1,
                                position: 'relative',
                            }}>
                                {isDisabled ? '(Disabled)' : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                        <div style={{ fontSize: iconSize, lineHeight: 1, marginTop: '2cqmin' }}>
                                            {GestureIcons[configuredGesture as GestureType].icon}
                                        </div>
                                    </div>
                                )}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * Ease-in cubic: slow start, accelerating (used for filling animation)
 */
function easeInCubic(t: number): number {
    return t * t * t;
}

/**
 * Ease-in quadratic: slow start, accelerating
 */
function easeInQuad(t: number): number {
    return t * t;
}

/**
 * Ease-in-out quadratic: slow start, fast middle, slow end
 */
function easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Linear interpolation with clamping
 */
function lerp(current: number, target: number, factor: number): number {
    const clamped = Math.min(1, Math.max(0, factor));
    return current + (target - current) * clamped;
}

/**
 * Determines the appropriate animation phase based on current state and inputs.
 * This is the core state machine logic that handles all phase transitions.
 */
function determinePhase(
    state: TriggerAnimState,
    isActive: boolean,
    isPending: boolean
): AnimationPhase {
    const { phase, displayProgress } = state;

    // Active trigger always takes precedence - it means the trigger fired
    if (isActive) {
        return 'completed';
    }

    // If we were completed and now inactive, start fading
    if (phase === 'completed' && !isActive) {
        return 'fading';
    }

    // Let fading complete naturally
    if (phase === 'fading') {
        return 'fading';
    }

    // Gesture is currently being detected
    if (isPending) {
        return 'filling';
    }

    // Gesture was lost while filling - reverse the animation
    if ((phase === 'filling' || phase === 'reversing') && !isPending && displayProgress > 0) {
        return 'reversing';
    }

    // Default to idle
    return 'idle';
}