import React from 'react';
import { cn } from '../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className,
  ...props
}) => {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-bold text-olive-400 uppercase tracking-widest">
          {label}
        </label>
      )}
      <input
        className={cn(
          'w-full bg-olive-800/50 border border-olive-700 rounded-xl px-4 py-3 text-white placeholder-olive-500 focus:border-gold-500 focus:outline-none transition-all',
          error && 'border-red-500',
          className
        )}
        title={props.title || props.placeholder || props['aria-label'] || 'Input field'}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
};