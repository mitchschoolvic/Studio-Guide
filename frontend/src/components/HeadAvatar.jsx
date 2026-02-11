import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function HeadAvatar({ faceData, isMeshEnabled }) {
    // Direct reference to the 3D mesh object
    const meshRef = useRef();

    useFrame(() => {
        if (!meshRef.current || !faceData) return;

        // 1. DIRECT MANIPULATION
        // Map Python coordinates (1920x1080 approx) to Three.js World Units
        // Assuming camera at z=10, we scale down.

        // Position
        // Center is 960, 540.
        // Scale factor 0.01 makes 1920 -> 19.2 units width.
        const x = (faceData.x - 960) * 0.01;
        const y = -(faceData.y - 540) * 0.01; // Invert Y
        const z = -faceData.depth * 0.05;

        meshRef.current.position.set(x, y, z);

        // Rotation (Convert degrees to radians if not already, or just use raw if python sends radians)
        // Python code sends Euler angles. Let's assume degrees?
        // Wait, cv2.RQDecomp3x3 returns degrees.
        const degToRad = Math.PI / 180;
        meshRef.current.rotation.x = faceData.pitch * degToRad;
        meshRef.current.rotation.y = -faceData.yaw * degToRad; // Mirror
        meshRef.current.rotation.z = -faceData.roll * degToRad;
    });

    if (!isMeshEnabled) return null;

    return (
        <mesh ref={meshRef}>
            <boxGeometry args={[1.5, 2, 1.2]} />
            <meshStandardMaterial
                color={faceData.id === 0 ? "#00ff88" : "#ff0088"}
                wireframe={true}
            />
        </mesh>
    );
}
