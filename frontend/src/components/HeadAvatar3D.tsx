import { useRef, useMemo, MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { FaceVector } from '../types/schemas';
import * as THREE from 'three';

interface Props {
    dataRef: MutableRefObject<(FaceVector | null)[]>;
    index: number;
    isMeshEnabled: boolean;
    showNeutralDot?: boolean;
}

export function HeadAvatar3D({ dataRef, index, isMeshEnabled }: Props) {
    const meshRef = useRef<THREE.Points>(null);
    const geometryRef = useRef<THREE.BufferGeometry>(null);
    const { viewport } = useThree();

    // MediaPipe face mesh has 468 landmarks
    const pointsCount = 468;
    const positions = useMemo(() => new Float32Array(pointsCount * 3), []);

    useFrame(() => {
        // Safety check: stop if disabled or unmounted
        if (!isMeshEnabled || !meshRef.current || !geometryRef.current) {
            return; // Just return silently, DO NOT LOG
        }
        const face = dataRef.current ? dataRef.current[index] : null;

        if (face && face.landmarks) {
            meshRef.current.visible = true;

            // Debug first landmark to ensure data integrity
            if (index === 0 && Math.random() < 0.01) {
                console.log("Avatar: Visible=TRUE. LM[0]:", face.landmarks[0]);
            }

            const positionsArray = geometryRef.current.attributes.position.array as Float32Array;

            // Simple scaling logic to match video aspect ratio (16:9) to the ThreeJS viewport
            const videoAspect = 16 / 9;
            const screenAspect = viewport.width / viewport.height;
            let scaleX, scaleY;

            if (screenAspect > videoAspect) {
                scaleX = viewport.width;
                scaleY = viewport.width / videoAspect;
            } else {
                scaleY = viewport.height;
                scaleX = viewport.height * videoAspect;
            }

            face.landmarks.forEach((lm, i) => {
                // Map 0..1 to centered coordinates
                const x = (lm[0] - 0.5) * scaleX;
                const y = -(lm[1] - 0.5) * scaleY; // Invert Y
                const z = -lm[2] * (scaleX * 0.5);

                positionsArray[i * 3] = x;
                positionsArray[i * 3 + 1] = y;
                positionsArray[i * 3 + 2] = z;
            });

            geometryRef.current.attributes.position.needsUpdate = true;
            meshRef.current.position.set(0, 0, 0);
            meshRef.current.rotation.set(0, 0, 0);

        } else {
            meshRef.current.visible = false;
        }
    });

    if (!isMeshEnabled) return null;

    return (
        <points ref={meshRef}>
            <bufferGeometry ref={geometryRef}>
                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                />
            </bufferGeometry>
            <pointsMaterial
                color={index === 0 ? "#00ff88" : "#00ccff"}
                size={0.15 * (viewport.width / 20)}
                sizeAttenuation={true}
            />
        </points>
    );
}