import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, defaultValue, onValueChange, min = 0, max = 100, step = 1, disabled, ...props }, ref) => {
    const currentValue = value?.[0] ?? defaultValue?.[0] ?? min;

    return (
      <input
        ref={ref}
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        disabled={disabled}
        onChange={(e) => onValueChange?.([Number(e.target.value)])}
        className={cn(
          "w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer",
          "accent-primary",
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md",
          "[&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      />
    );
  }
);
Slider.displayName = "Slider";

export { Slider };
