import { Canvas } from '@react-three/fiber';
import { MutableRefObject } from 'react';
import { FaceVector } from '../../types/schemas';
import { HeadAvatar3D } from '../HeadAvatar3D';
import { useConfig } from '../../contexts/ConfigContext';

interface Props {
    dataRef: MutableRefObject<(FaceVector | null)[]>;
}

export function FaceMeshLayer({ dataRef }: Props) {
    const { settings } = useConfig();
    const isMeshEnabled = !!settings.showMesh;

    // FIX: Conditionally render the components so they unmount when disabled
    if (!isMeshEnabled) return null;

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'scaleX(-1)' }}>
            <Canvas camera={{ position: [0, 0, 10], fov: 50 }} gl={{ alpha: true }}>
                <ambientLight intensity={0.8} />
                <pointLight position={[10, 10, 10]} />
                <HeadAvatar3D dataRef={dataRef} index={0} isMeshEnabled={true} />
                <HeadAvatar3D dataRef={dataRef} index={1} isMeshEnabled={true} />
            </Canvas>
        </div>
    );
}
