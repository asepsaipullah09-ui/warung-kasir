// Utility functions for exporting reports (Excel/PDF) and printing receipts

export const formatRupiahExport = (amount: number | null | undefined) =>
  'Rp ' + (amount || 0).toLocaleString('id-ID')

export const formatDateExport = (dateString: string | null | undefined) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export data ke file Excel (.xls) tanpa library tambahan.
 * Menggunakan format HTML table yang didukung penuh oleh Microsoft Excel.
 */
export function exportToExcel(
  filename: string,
  columns: { header: string; key: string }[],
  rows: Record<string, unknown>[]
) {
  const head =
    '<tr>' +
    columns
      .map(
        (c) =>
          `<th style="background:#059669;color:#fff;padding:6px 10px;border:1px solid #ddd;font-weight:bold;">${c.header}</th>`
      )
      .join('') +
    '</tr>'

  const body = rows
    .map(
      (row) =>
        '<tr>' +
        columns
          .map((c) => `<td style="padding:6px 10px;border:1px solid #ddd;">${row[c.key] ?? ''}</td>`)
          .join('') +
        '</tr>'
    )
    .join('')

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table>${head}${body}</table></body></html>`
  const blob = new Blob(['\ufeff' + html], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  })
  triggerDownload(blob, `${filename}.xls`)
}

/**
 * Membuka window cetak berisi dokumen laporan.
 * Pengguna bisa mencetak langsung atau "Save as PDF".
 */
export function printDocument(
  title: string,
  htmlContent: string,
  opts?: { header?: boolean; footerNote?: string }
) {
  const { header = true, footerNote } = opts || {}
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    alert('Pop-up diblokir! Izinkan pop-up untuk mencetak dokumen.')
    return
  }

  const head = header
    ? `<h1>🛒 ${title}</h1>
       <div class="meta">Dicetak: ${new Date().toLocaleString('id-ID')} • Kasir Warung</div>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; padding: 40px; color: #111; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .meta { color: #555; font-size: 13px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #059669; color: #fff; padding: 8px 10px; text-align: left; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #f9fafb; }
    .summary { margin-top: 24px; font-size: 14px; }
    .summary p { margin: 4px 0; }
    .footer { margin-top: 32px; font-size: 11px; color: #888; border-top: 1px dashed #ccc; padding-top: 12px; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  ${head}
  ${htmlContent}
  ${footerNote ? `<div class="footer">${footerNote}</div>` : ''}
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`

  win.document.write(html)
  win.document.close()
  win.focus()
}

/**
 * Mencetak struk transaksi format thermal 80mm (font monospace).
 */
export function printReceipt(receipt: {
  id: string
  date: string
  items: { name: string; qty: number; price: number; subtotal: number }[]
  total: number
  method: string
  cash?: number
  change?: number
  customerName?: string
}) {
  const lines = receipt.items
    .map(
      (it) =>
        `<tr>
          <td>${it.name}</td>
          <td style="text-align:center">${it.qty}</td>
          <td style="text-align:right">${formatRupiahExport(it.price)}</td>
          <td style="text-align:right">${formatRupiahExport(it.subtotal)}</td>
        </tr>`
    )
    .join('')

  const html = `
    <div style="font-family:'Courier New',monospace;max-width:320px;margin:0 auto;font-size:13px;">
      <div style="text-align:center;margin-bottom:8px;">
        <div style="font-size:18px;font-weight:bold;">🛒 KASIR WARUNG</div>
        <div>Jl. Contoh No.1, Jakarta</div>
        <div>Telp: 0812-3456-7890</div>
      </div>
      <hr>
      <div>No: ${receipt.id}</div>
      <div>${formatDateExport(receipt.date)}</div>
      ${receipt.customerName ? `<div>Pelanggan: ${receipt.customerName}</div>` : ''}
      <hr>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <th style="text-align:left">Item</th>
          <th>Qty</th>
          <th>Harga</th>
          <th>Subtotal</th>
        </tr>
        ${lines}
      </table>
      <hr>
      <div style="display:flex;justify-content:space-between;">
        <span>Total</span>
        <span style="font-weight:bold;">${formatRupiahExport(receipt.total)}</span>
      </div>
      ${receipt.cash ? `<div style="display:flex;justify-content:space-between;"><span>Bayar</span><span>${formatRupiahExport(receipt.cash)}</span></div>` : ''}
      ${receipt.change !== undefined && receipt.change >= 0 ? `<div style="display:flex;justify-content:space-between;"><span>Kembalian</span><span>${formatRupiahExport(receipt.change)}</span></div>` : ''}
      <div style="text-align:center;margin-top:12px;">Terima kasih 🙏</div>
      <div style="text-align:center;font-size:11px;">Barang yang sudah dibeli tidak dapat ditukar</div>
    </div>`

  printDocument('Struk Transaksi', html, { header: false })
}

