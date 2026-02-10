
import { NeutralInteractionOverlay } from '../overlays/NeutralInteractionOverlay';

interface Props {
    isHovered: boolean;
}

export function NeutralInteractionLayer({ isHovered }: Props) {
    return (
        <NeutralInteractionOverlay isHovered={isHovered} />
    );
}
