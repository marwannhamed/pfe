import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';

// ─── Types ────────────────────────────────────────────────────────────────────
interface InvoicePDFProps {
  invoice: {
    id:             string;
    invoice_number: string;
    type:           string;
    status:         string;
    issue_date:     string;
    due_date:       string;
    total_amount:   string;
    currency:       string;
    description?:   string;
    tenant?:        { name?: string; contact_email?: string; slug?: string };
    contract?:      { contract_number?: string };
    payments?:      {
      amount: string | number;
      payment_date: string;
      status: string;
      method?: string;
      payment_method?: string;
    }[];
    lines?:         { description?: string; quantity?: number | string; unit_price?: number | string; line_total?: number | string }[];
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(d?: string | null) {
  if (!d) return '—';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function formatAmt(amount: string | number | null | undefined, currency = 'USD') {
  const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  const n = parseFloat(String(amount ?? 0));
  return `${sym}${(Number.isNaN(n) ? 0 : n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function labelFromCode(value?: string | null, fallback = '—') {
  if (!value || typeof value !== 'string') return fallback;
  return value.replace(/_/g, ' ');
}
function paymentMethodLabel(p: { method?: string; payment_method?: string }) {
  return labelFromCode(p.payment_method ?? p.method, 'Payment');
}

const STATUS_COLORS: Record<string, string> = {
  PAID:           '#15803d',
  ISSUED:         '#1d4ed8',
  SENT:           '#6d28d9',
  PARTIALLY_PAID: '#92400e',
  OVERDUE:        '#b91c1c',
  DRAFT:          '#475569',
  CANCELLED:      '#94a3b8',
};
const STATUS_BG: Record<string, string> = {
  PAID:           '#dcfce7',
  ISSUED:         '#dbeafe',
  SENT:           '#ede9fe',
  PARTIALLY_PAID: '#fef3c7',
  OVERDUE:        '#fee2e2',
  DRAFT:          '#f1f5f9',
  CANCELLED:      '#f1f5f9',
};

// ─── PDF Styles ───────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily:      'Helvetica',
    fontSize:        10,
    color:           '#0f172a',
    backgroundColor: '#ffffff',
    paddingTop:      40,
    paddingBottom:   60,
    paddingHorizontal: 50,
  },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 },
  logoBox: { width: 44, height: 44, backgroundColor: '#2563eb', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#ffffff', fontSize: 18, fontFamily: 'Helvetica-Bold' },
  companyName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginTop: 6 },
  companyTagline: { fontSize: 9, color: '#94a3b8', marginTop: 2 },
  invoiceLabel: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: '#0f172a', textAlign: 'right' },
  invoiceNumber: { fontSize: 11, color: '#2563eb', textAlign: 'right', marginTop: 4, fontFamily: 'Helvetica-Bold' },

  // Status badge
  statusBadge: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 24 },
  badgeInner: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 10, fontFamily: 'Helvetica-Bold' },

  // Divider
  divider: { height: 1, backgroundColor: '#e5e7eb', marginBottom: 24 },
  dividerBlue: { height: 3, backgroundColor: '#2563eb', marginBottom: 24, borderRadius: 2 },

  // Info row
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  infoBlock: { flex: 1 },
  infoLabel: { fontSize: 9, color: '#94a3b8', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  infoValue: { fontSize: 11, color: '#0f172a', fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  infoSub: { fontSize: 9, color: '#64748b', marginBottom: 2 },

  // Table
  tableHeader: { flexDirection: 'row', backgroundColor: '#0f172a', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6, marginBottom: 2 },
  tableHeaderText: { color: '#ffffff', fontSize: 9, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  tableCell: { fontSize: 10, color: '#374151' },
  tableCellBold: { fontSize: 10, color: '#0f172a', fontFamily: 'Helvetica-Bold' },

  // Totals
  totalsBox: { marginTop: 20, marginLeft: 'auto', width: 240 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 12 },
  totalLabel: { fontSize: 10, color: '#64748b' },
  totalValue: { fontSize: 10, color: '#0f172a', fontFamily: 'Helvetica-Bold' },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#0f172a', borderRadius: 8, marginTop: 4 },
  grandTotalLabel: { fontSize: 12, color: '#ffffff', fontFamily: 'Helvetica-Bold' },
  grandTotalValue: { fontSize: 14, color: '#ffffff', fontFamily: 'Helvetica-Bold' },

  // Payment history
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 10, marginTop: 28 },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  payLabel: { fontSize: 9, color: '#64748b' },
  payValue: { fontSize: 9, color: '#0f172a', fontFamily: 'Helvetica-Bold' },

  // Notes
  notesBox: { marginTop: 28, backgroundColor: '#f8fafc', borderRadius: 8, padding: 14, borderLeftWidth: 3, borderLeftColor: '#2563eb' },
  notesLabel: { fontSize: 9, color: '#2563eb', fontFamily: 'Helvetica-Bold', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  notesText: { fontSize: 9, color: '#64748b', lineHeight: 1.5 },

  // Footer
  footer: { position: 'absolute', bottom: 30, left: 50, right: 50 },
  footerDivider: { height: 1, backgroundColor: '#e5e7eb', marginBottom: 12 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: '#94a3b8' },
  footerBrand: { fontSize: 8, color: '#2563eb', fontFamily: 'Helvetica-Bold' },
});

// ─── PDF Document ─────────────────────────────────────────────────────────────
function InvoicePDFDocument({ invoice }: InvoicePDFProps) {
  const status = invoice.status ?? 'DRAFT';
  const invType = invoice.type ?? 'LEASE';
  const currency = invoice.currency ?? 'USD';
  const totalAmount = parseFloat(String(invoice.total_amount ?? 0)) || 0;
  const payments = invoice.payments ?? [];
  const lineItems = (invoice.lines ?? []).filter((l) => l?.description);
  const primaryDescription =
    invoice.description?.trim() ||
    lineItems[0]?.description?.trim() ||
    `${labelFromCode(invType)} — ${invoice.invoice_number ?? ''}`;

  const totalPaid = payments
    .filter((p) => p.status === 'COMPLETED')
    .reduce((s, p) => s + (parseFloat(String(p.amount)) || 0), 0);
  const remaining = totalAmount - totalPaid;
  const statusColor = STATUS_COLORS[status] ?? '#475569';
  const statusBg    = STATUS_BG[status]    ?? '#f1f5f9';

  return (
    <Document title={`Invoice ${invoice.invoice_number}`} author="LeaseManager" subject="Lease Invoice">
      <Page size="A4" style={S.page}>

        {/* ── Header ── */}
        <View style={S.header}>
          <View>
            <View style={S.logoBox}>
              <Text style={S.logoText}>LM</Text>
            </View>
            <Text style={S.companyName}>LeaseManager</Text>
            <Text style={S.companyTagline}>Office Space Management Platform</Text>
          </View>
          <View>
            <Text style={S.invoiceLabel}>INVOICE</Text>
            <Text style={S.invoiceNumber}>{invoice.invoice_number}</Text>
          </View>
        </View>

        {/* Status badge */}
        <View style={S.statusBadge}>
          <View style={[S.badgeInner, { backgroundColor: statusBg }]}>
            <Text style={[S.badgeText, { color: statusColor }]}>{labelFromCode(status)}</Text>
          </View>
        </View>

        <View style={S.dividerBlue} />

        {/* ── Bill To + Invoice Details ── */}
        <View style={S.infoRow}>
          <View style={S.infoBlock}>
            <Text style={S.infoLabel}>Bill To</Text>
            <Text style={S.infoValue}>{invoice.tenant?.name ?? '—'}</Text>
            {invoice.tenant?.contact_email && <Text style={S.infoSub}>{invoice.tenant.contact_email}</Text>}
            {invoice.tenant?.slug && <Text style={S.infoSub}>@{invoice.tenant.slug}</Text>}
            {invoice.contract?.contract_number && (
              <Text style={[S.infoSub, { marginTop: 6, color: '#2563eb' }]}>
                Contract: {invoice.contract.contract_number}
              </Text>
            )}
          </View>
          <View style={{ width: 40 }} />
          <View style={[S.infoBlock, { alignItems: 'flex-end' }]}>
            <Text style={S.infoLabel}>Invoice Details</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <View style={{ alignItems: 'flex-end', marginRight: 20 }}>
                <Text style={S.infoSub}>Issue Date</Text>
                <Text style={S.infoValue}>{formatDate(invoice.issue_date)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={S.infoSub}>Due Date</Text>
                <Text style={[S.infoValue, status === 'OVERDUE' ? { color: '#b91c1c' } : {}]}>
                  {formatDate(invoice.due_date)}
                </Text>
              </View>
            </View>
            <View style={{ marginTop: 8, alignItems: 'flex-end' }}>
              <Text style={S.infoSub}>Currency</Text>
              <Text style={S.infoValue}>{invoice.currency}</Text>
            </View>
          </View>
        </View>

        <View style={S.divider} />

        {/* ── Line Items Table ── */}
        <View style={S.tableHeader}>
          <Text style={[S.tableHeaderText, { flex: 3 }]}>Description</Text>
          <Text style={[S.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Type</Text>
          <Text style={[S.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Amount</Text>
        </View>

        {(lineItems.length > 0 ? lineItems : [{ description: primaryDescription, line_total: totalAmount }]).map((line, idx) => (
          <View key={idx} style={[S.tableRow, idx % 2 === 1 ? S.tableRowAlt : {}]}>
            <Text style={[S.tableCell, { flex: 3 }]}>{line.description ?? primaryDescription}</Text>
            <Text style={[S.tableCell, { flex: 1, textAlign: 'center' }]}>
              {labelFromCode(invType).toLowerCase()}
            </Text>
            <Text style={[S.tableCellBold, { flex: 1, textAlign: 'right' }]}>
              {formatAmt(line.line_total ?? totalAmount, currency)}
            </Text>
          </View>
        ))}

        {/* ── Totals ── */}
        <View style={S.totalsBox}>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>Subtotal</Text>
            <Text style={S.totalValue}>{formatAmt(totalAmount, currency)}</Text>
          </View>
          {totalPaid > 0 && (
            <View style={S.totalRow}>
              <Text style={[S.totalLabel, { color: '#15803d' }]}>Paid</Text>
              <Text style={[S.totalValue, { color: '#15803d' }]}>− {formatAmt(totalPaid, currency)}</Text>
            </View>
          )}
          <View style={S.grandTotalRow}>
            <Text style={S.grandTotalLabel}>{remaining > 0 ? 'Amount Due' : 'Total Paid'}</Text>
            <Text style={S.grandTotalValue}>{formatAmt(remaining > 0 ? remaining : totalAmount, currency)}</Text>
          </View>
        </View>

        {/* ── Payment History ── */}
        {payments.length > 0 && (
          <>
            <Text style={S.sectionTitle}>Payment History</Text>
            <View style={[S.tableHeader, { backgroundColor: '#334155' }]}>
              <Text style={[S.tableHeaderText, { flex: 2 }]}>Date</Text>
              <Text style={[S.tableHeaderText, { flex: 2 }]}>Method</Text>
              <Text style={[S.tableHeaderText, { flex: 1 }]}>Status</Text>
              <Text style={[S.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Amount</Text>
            </View>
            {payments.map((p, i) => (
              <View key={i} style={[S.payRow, i % 2 === 0 ? {} : { backgroundColor: '#f8fafc' }]}>
                <Text style={[S.payLabel, { flex: 2 }]}>{formatDate(p.payment_date)}</Text>
                <Text style={[S.payLabel, { flex: 2 }]}>{paymentMethodLabel(p).toLowerCase()}</Text>
                <Text style={[S.payLabel, { flex: 1, color: p.status === 'COMPLETED' ? '#15803d' : '#94a3b8' }]}>{p.status ?? '—'}</Text>
                <Text style={[S.payValue, { flex: 1, textAlign: 'right' }]}>{formatAmt(p.amount, currency)}</Text>
              </View>
            ))}
          </>
        )}

        {/* ── Notes ── */}
        {status === 'OVERDUE' ? (
          <View style={[S.notesBox, { borderLeftColor: '#ef4444', backgroundColor: '#fff5f5' }]}>
            <Text style={[S.notesLabel, { color: '#ef4444' }]}>⚠ Overdue Notice</Text>
            <Text style={S.notesText}>
              This invoice is past its due date of {formatDate(invoice.due_date)}. Please arrange payment as soon as possible to avoid any service interruption. Contact us at billing@leasemanager.com if you need assistance.
            </Text>
          </View>
        ) : status === 'PAID' ? (
          <View style={[S.notesBox, { borderLeftColor: '#15803d', backgroundColor: '#f0fdf4' }]}>
            <Text style={[S.notesLabel, { color: '#15803d' }]}>✓ Payment Confirmed</Text>
            <Text style={S.notesText}>
              This invoice has been paid in full. Thank you for your prompt payment. Please keep this document for your records.
            </Text>
          </View>
        ) : (
          <View style={S.notesBox}>
            <Text style={S.notesLabel}>Payment Instructions</Text>
            <Text style={S.notesText}>
              Please ensure payment is made before the due date shown above. Accepted methods include bank transfer, cheque, and online payment. Reference your invoice number in all correspondence.
            </Text>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={S.footer} fixed>
          <View style={S.footerDivider} />
          <View style={S.footerRow}>
            <Text style={S.footerText}>Generated by LeaseManager · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
            <Text style={S.footerBrand}>leasemanager.com</Text>
            <Text style={S.footerText}>Invoice {invoice.invoice_number}</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}

// ─── Download Button ──────────────────────────────────────────────────────────
function canRenderInvoicePdf(invoice: InvoicePDFProps['invoice'] | null | undefined) {
  return Boolean(invoice?.invoice_number && invoice?.total_amount != null);
}

export function InvoiceDownloadButton({ invoice, style }: { invoice: InvoicePDFProps['invoice']; style?: React.CSSProperties }) {
  if (!canRenderInvoicePdf(invoice)) return null;
  return (
    <PDFDownloadLink
      document={<InvoicePDFDocument invoice={invoice} />}
      fileName={`${invoice.invoice_number}.pdf`}
      style={{ textDecoration: 'none' }}
    >
      {({ loading }) => (
        <button
          style={{
            padding: '6px 12px', borderRadius: 7,
            background: loading ? '#e5e7eb' : 'linear-gradient(135deg,#dc2626,#ef4444)',
            border: 'none', color: '#fff', fontSize: 11, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            ...style,
          }}
        >
          {loading ? '⏳ Preparing...' : '📄 PDF'}
        </button>
      )}
    </PDFDownloadLink>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────
export function InvoicePreviewModal({ invoice, onClose }: { invoice: InvoicePDFProps['invoice']; onClose: () => void }) {
  if (!canRenderInvoicePdf(invoice)) return null;
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal header */}
      <div style={{ width: '100%', maxWidth: 700, background: '#0f172a', borderRadius: '12px 12px 0 0', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>📄</span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{invoice.invoice_number}</span>
          <span style={{ background: '#1e293b', color: '#94a3b8', fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>Preview</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <PDFDownloadLink
            document={<InvoicePDFDocument invoice={invoice} />}
            fileName={`${invoice.invoice_number}.pdf`}
            style={{ textDecoration: 'none' }}
          >
            {({ loading }) => (
              <button style={{ padding: '7px 16px', borderRadius: 8, background: loading ? '#334155' : '#2563eb', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {loading ? '⏳ Preparing...' : '⬇ Download PDF'}
              </button>
            )}
          </PDFDownloadLink>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #334155', background: '#1e293b', cursor: 'pointer', color: '#94a3b8', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div style={{ width: '100%', maxWidth: 700, height: '80vh', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
        <PDFViewer width="100%" height="100%" showToolbar={false} style={{ border: 'none' }}>
          <InvoicePDFDocument invoice={invoice} />
        </PDFViewer>
      </div>
    </div>
  );
}

export default InvoicePDFDocument;