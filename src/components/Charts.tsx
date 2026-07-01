import React from 'react';

interface ChartProps {
  data: { date: string; value: number }[];
  color: string;
  height?: number;
}

export const LineChart: React.FC<ChartProps> = ({ data, color, height = 200 }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
      }}>
        Aucune donnée disponible
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;
  
  const width = 100;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.value - minValue) / range) * (height - 40) - 20;
    return { x, y, value: d.value, date: d.date };
  });

  const pathD = points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <div style={{ height, position: 'relative' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Area */}
        <path d={areaD} fill={`url(#gradient-${color.replace('#', '')})`} />
        
        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={color}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="1"
          />
        ))}
      </svg>
      
      {/* Labels */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        paddingTop: 8,
      }}>
        {data.filter((_, i) => i % Math.ceil(data.length / 5) === 0).map((d, i) => (
          <span key={i}>{new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
        ))}
      </div>
    </div>
  );
};

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
}

export const BarChart: React.FC<BarChartProps> = ({ data, height = 200 }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
      }}>
        Aucune donnée disponible
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const barWidth = 100 / data.length;

  return (
    <div style={{ height, position: 'relative' }}>
      <svg width="100%" height={height} viewBox="0 0 100 100" preserveAspectRatio="none">
        {data.map((d, i) => {
          const barHeight = (d.value / maxValue) * 80;
          const x = i * barWidth + barWidth * 0.1;
          const width = barWidth * 0.8;
          const y = 90 - barHeight;
          
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={width}
              height={barHeight}
              fill={d.color || '#D4AF37'}
              rx="2"
              opacity="0.8"
            />
          );
        })}
      </svg>
      
      {/* Labels */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-around',
        fontSize: 9,
        color: 'rgba(255,255,255,0.4)',
        paddingTop: 8,
      }}>
        {data.map((d, i) => (
          <span key={i} style={{ flex: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
};

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({ data, size = 200 }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
      }}>
        Aucune donnée
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  
  let currentOffset = 0;
  const segments = data.map(d => {
    const percentage = d.value / total;
    const strokeDasharray = `${percentage * circumference} ${circumference}`;
    const offset = currentOffset;
    currentOffset += percentage * circumference;
    
    return {
      ...d,
      strokeDasharray,
      offset,
      percentage: percentage * 100,
    };
  });

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        {segments.map((segment, i) => (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth="20"
            strokeDasharray={segment.strokeDasharray}
            strokeDashoffset={-segment.offset}
            transform="rotate(-90 50 50)"
            opacity="0.8"
          />
        ))}
      </svg>
      
      {/* Center text */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#eeeef5' }}>
          {total.toLocaleString()}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          Total
        </div>
      </div>
    </div>
  );
};