import React, { useRef, useEffect, useState } from 'react';

interface FitTextProps {
    text: string;
    maxFontSize?: number;
    minFontSize?: number;
    className?: string;
    style?: React.CSSProperties;
    color?: string; // Add color prop specifically since we handle styles internally
}

export const FitText: React.FC<FitTextProps> = ({
    text,
    maxFontSize = 200,
    minFontSize = 12,
    className,
    style,
    color
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [fontSize, setFontSize] = useState(minFontSize);

    useEffect(() => {
        const calculateFontSize = () => {
            if (!containerRef.current || !textRef.current) return;

            const containerWidth = containerRef.current.clientWidth;
            const containerHeight = containerRef.current.clientHeight;
            const textLength = text.length;

            // Heuristic start point: Width / (Chars * constant)
            // Constant 0.6 is a rough average aspect ratio for fonts
            let estimatedSize = containerWidth / (Math.max(textLength, 1) * 0.6);

            // Constrain by height (approx 80% container height)
            estimatedSize = Math.min(estimatedSize, containerHeight * 0.8);

            // Clamp
            const finalSize = Math.min(Math.max(estimatedSize, minFontSize), maxFontSize);

            setFontSize(finalSize);
        };

        // Initial calc
        calculateFontSize();

        // Observer
        const observer = new ResizeObserver(calculateFontSize);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [text, maxFontSize, minFontSize]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                ...style
            }}
        >
            <span
                ref={textRef}
                style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    fontWeight: 800,
                    color: color || 'inherit',
                    transition: 'font-size 0.1s ease-out'
                }}
            >
                {text}
            </span>
        </div>
    );
};
