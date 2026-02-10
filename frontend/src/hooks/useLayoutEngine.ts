import { useState, useEffect, MutableRefObject, useRef } from 'react';
import { FaceVector } from '../types/schemas';
export type LayoutState = 'SOLO' | 'DUO' | 'CROWD_WARNING';
/**
 * useLayoutEngine
 * 
 * Determines the layout state based on the number of detected faces.
 * Encapsulates the logic for switching between Solo, Duo, and Crowd modes.
 * 
 * Accepts a MutableRefObject containing face data and polls it for changes
 * to ensure the UI updates reactively.
 * 
 * @param faceDataRef The ref object containing current face data.
 * @returns The current LayoutState.
 */
export function useLayoutEngine(faceDataRef: MutableRefObject<(FaceVector | null)[]>): LayoutState {
    const [layoutState, setLayoutState] = useState<LayoutState>('SOLO');
    // Let's use a proper ref for the timer to avoid closure staleness and re-renders
    // But wait, useState return tuple is [state, setState]. The generated code used index 0 which is state.
    // I should use useRef for the timer.
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const checkLayout = () => {
            const faces = faceDataRef.current;
            if (!faces) return;
            const count = faces.filter(f => f !== null).length;

            // Determine Target State
            let targetState: LayoutState = 'SOLO';
            if (count >= 3) {
                targetState = 'CROWD_WARNING';
            } else if (count === 2) {
                targetState = 'DUO';
            } else {
                targetState = 'SOLO';
            }

            // State Transition Logic with Grace Period
            setLayoutState(currentState => {
                if (targetState === 'CROWD_WARNING') {
                    // If we are already in warning, stay there
                    if (currentState === 'CROWD_WARNING') return currentState;

                    // If we are not in warning, check if timer is running
                    if (!timerRef.current) {
                        // Start Grace Period Timer
                        timerRef.current = setTimeout(() => {
                            setLayoutState('CROWD_WARNING');
                            timerRef.current = null;
                        }, 2000);
                    }
                    // Return current state while waiting
                    return currentState;
                } else {
                    // Not in warning target (0, 1, or 2 faces)

                    // CLEAR TIMER if it was running (False positive avoided)
                    if (timerRef.current) {
                        clearTimeout(timerRef.current);
                        timerRef.current = null;
                    }

                    // IMMEDIATE transition out of warning or between normal states
                    return targetState;
                }
            });
        };

        // Poll at 10Hz
        const interval = setInterval(checkLayout, 100);

        // Initial check
        checkLayout();

        return () => {
            clearInterval(interval);
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [faceDataRef]);

    return layoutState;
}
