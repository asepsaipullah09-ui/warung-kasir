'use client'
import { useState } from 'react'
import { formatRupiah } from '@/lib/utils'

interface BarChartProps {
  data: { label: string; value: number }[]
  title?: string
  color?: string
  valueFormatter?: (value: number) => string
}

/**
 * Bar chart ringan berbasis Flexbox/SVG murni (tanpa library eksternal).
 * Mendukung tooltip saat hover dan format nilai custom.
 */
export default function BarChart({
  data,
  title,
  color = '#059669',
  valueFormatter,
}: BarChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        <div className="text-4xl mb-2">📊</div>
        <p>Belum ada data untuk ditampilkan</p>
      </div>
    )
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1)
  const chartHeight = 240
  const labelSpace = 36
  const topSpace = 24
  const barMaxHeight = chartHeight - labelSpace - topSpace
  const formatValue = (v: number) => (valueFormatter ? valueFormatter(v) : formatRupiah(v))

  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        </div>
      )}

      <div className="relative" style={{ height: chartHeight }}>
        {/* Garis bantu horizontal */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <div
            key={f}
            className="absolute left-0 right-0 border-t border-dashed border-gray-200"
            style={{ bottom: labelSpace + barMaxHeight * f }}
          />
        ))}

        {/* Bar */}
        <div
          className="flex items-end gap-1 relative"
          style={{ height: barMaxHeight + labelSpace }}
        >
          {data.map((d, i) => {
            const h = d.value > 0 ? Math.max((d.value / maxValue) * barMaxHeight, 4) : 2
            const isHover = hoverIndex === i
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end h-full min-w-0 group cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              >
                {/* Tooltip */}
                {isHover && (
                  <div className="absolute bottom-full mb-1 bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap z-20 shadow-lg pointer-events-none">
                    <div className="font-semibold">{d.label}</div>
                    <div>{formatValue(d.value)}</div>
                  </div>
                )}

                <div
                  className="w-full max-w-[44px] mx-auto rounded-t transition-all duration-150"
                  style={{
                    height: h,
                    backgroundColor: isHover ? '#065f46' : color,
                    opacity: d.value === 0 ? 0.3 : 1,
                  }}
                />
                <div className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">
                  {d.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

