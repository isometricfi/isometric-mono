
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Area,
  ComposedChart
} from 'recharts';

interface PayoffChartProps {
  type: 'buyer' | 'writer';
  strike: number;
  premium: number; // Premium in USD
  quantity: number; // Quantity in BTC (e.g., 1.0)
  domain?: [number, number];
}

const PayoffChart = ({ type, strike, premium, quantity, domain }: PayoffChartProps) => {
  // Generate data points
  const generateData = () => {
    const range = domain || [strike * 0.5, strike * 1.5];
    const step = (range[1] - range[0]) / 50;
    const data = [];
    let minRoi = 0;
    let maxRoi = 0;

    // Collateral value at strike (for writer ROI calculation)
    const collateralValue = quantity * strike;

    for (let price = range[0]; price <= range[1]; price += step) {
      let pnlUsd = 0;
      
      if (type === 'buyer') {
        // Buyer PnL calculation:
        // Intrinsic value in BTC = max(0, (price - strike) / price) * quantity
        // This represents the BTC payout at settlement
        const intrinsicValueBtc = Math.max(0, (price - strike) / price) * quantity;
        const intrinsicValueUsd = intrinsicValueBtc * price;
        pnlUsd = intrinsicValueUsd - premium;
      } else {
        // Writer PnL calculation:
        // Writer pays out the intrinsic value and keeps premium
        const intrinsicValueBtc = Math.max(0, (price - strike) / price) * quantity;
        const intrinsicValueUsd = intrinsicValueBtc * price;
        pnlUsd = premium - intrinsicValueUsd;
      }
      
      // Calculate ROI
      let roi = 0;
      if (type === 'buyer') {
        // Buyer ROI: return on premium paid
        roi = (pnlUsd / premium) * 100;
      } else {
        // Writer ROI: return on collateral locked
        roi = (pnlUsd / collateralValue) * 100;
      }
      
      if (roi < minRoi) minRoi = roi;
      if (roi > maxRoi) maxRoi = roi;

      data.push({ 
        price: Number(price.toFixed(2)), 
        pnl: Number(pnlUsd.toFixed(2)),
        roi: Number(roi.toFixed(2))
      });
    }
    return { data, minRoi, maxRoi };
  };

  const { data, minRoi, maxRoi } = generateData();
  
  // Calculate gradient offset to split colors at 0
  const gradientOffset = () => {
    if (maxRoi <= 0) return 0;
    if (minRoi >= 0) return 1;
    return maxRoi / (maxRoi - minRoi);
  };

  const off = gradientOffset();

  // Colors using Docusaurus CSS variables
  const profitColor = '#10B981'; // Fixed colors for semantic meaning (Green)
  const lossColor = '#EF4444';   // Fixed colors for semantic meaning (Red)
  const gridColor = 'var(--ifm-color-emphasis-200)';
  const textColor = 'var(--ifm-color-content-secondary)';
  const tooltipBg = 'var(--ifm-background-surface-color)';
  const tooltipColor = 'var(--ifm-color-content)';
  const tooltipBorder = 'var(--ifm-color-emphasis-200)';

  // Formatting
  const formatCurrency = (val: number) => `$${val.toLocaleString()}`;
  const formatPercent = (val: number) => `${val.toFixed(1)}%`;

  return (
    <div style={{ width: '100%', height: 400, margin: '2rem 0', fontFamily: 'var(--ifm-font-family-base)' }}>
      {/* @ts-ignore - Recharts children type issue */}
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          
          <XAxis 
            dataKey="price" 
            type="number" 
            domain={['auto', 'auto']}
            tickFormatter={formatCurrency}
            stroke={textColor}
            label={{ value: 'Bitcoin Price', position: 'bottom', offset: 0, fill: textColor }}
          />
          
          <YAxis 
            tickFormatter={formatPercent}
            stroke={textColor}
            label={{ value: 'ROI (%)', angle: -90, position: 'insideLeft', fill: textColor }}
          />
          
          <Tooltip 
            formatter={(value: number) => [formatPercent(value), 'ROI']}
            labelFormatter={(label: number) => `BTC Price: ${formatCurrency(label)}`}
            contentStyle={{ 
              backgroundColor: tooltipBg, 
              borderColor: tooltipBorder,
              color: tooltipColor 
            }}
          />

          {/* Zero Line */}
          <ReferenceLine y={0} stroke={textColor} strokeWidth={1} />
          
          {/* Strike Line */}
          <ReferenceLine 
            x={strike} 
            stroke={textColor} 
            strokeDasharray="5 5" 
            label={{ value: 'Strike', position: 'top', fill: textColor }} 
          />

          {/* Gradient definitions for area fill and stroke */}
          <defs>
            <linearGradient id={`splitColor${type}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset={off} stopColor={profitColor} stopOpacity={0.3} />
              <stop offset={off} stopColor={lossColor} stopOpacity={0.3} />
            </linearGradient>
            <linearGradient id={`splitLine${type}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset={off} stopColor={profitColor} stopOpacity={1} />
              <stop offset={off} stopColor={lossColor} stopOpacity={1} />
            </linearGradient>
          </defs>

          <Area 
            type="monotone" 
            dataKey="roi" 
            stroke="none" 
            fill={`url(#splitColor${type})`} 
          />

          <Line 
            type="monotone" 
            dataKey="roi" 
            stroke={`url(#splitLine${type})`} 
            strokeWidth={3} 
            dot={false} 
            activeDot={{ r: 6 }} 
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PayoffChart;
