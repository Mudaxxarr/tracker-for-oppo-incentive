import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

const C = {
  primary: "#0A6E5C",
  bg: "#F0FDF4",
  border: "#BBF7D0",
  dark: "#0F172A",
  muted: "#64748B",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: C.white,
    padding: 36,
    fontSize: 11,
    color: C.dark,
  },
  header: {
    backgroundColor: C.primary,
    borderRadius: 6,
    padding: "16 20",
    marginBottom: 20,
  },
  headerTitle: {
    color: C.white,
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  headerSub: {
    color: C.bg,
    fontSize: 10,
    marginTop: 3,
  },
  receiptTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  refRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    borderBottom: `1 solid ${C.border}`,
    paddingBottom: 10,
  },
  refText: {
    fontSize: 10,
    color: C.muted,
  },
  section: {
    backgroundColor: C.bg,
    borderRadius: 6,
    border: `1 solid ${C.border}`,
    padding: "12 14",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: 110,
    color: C.muted,
    fontSize: 10,
  },
  value: {
    flex: 1,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  totalBox: {
    backgroundColor: C.primary,
    borderRadius: 6,
    padding: "14 16",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  totalLabel: {
    color: C.bg,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  totalValue: {
    color: C.white,
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    marginTop: "auto",
    borderTop: `1 solid ${C.border}`,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 9,
    color: C.muted,
  },
});

export interface ReceiptData {
  activationId: string;
  dealerName: string;
  businessName: string;
  activationDate: string;
  modelName: string;
  imei: string | null;
  dealerPrice: number;
  customerName: string | null;
  customerPhone: string | null;
  customerCnic: string | null;
}

function fmt(n: number) {
  return `PKR ${n.toLocaleString("en-PK")}`;
}

function fmtDate(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });
}

const ReceiptDocument = ({ data }: { data: ReceiptData }) => (
  <Document title="Sale Receipt">
    <Page size={[220, 360]} style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{data.businessName}</Text>
        <Text style={styles.headerSub}>{data.dealerName}</Text>
      </View>

      <Text style={styles.receiptTitle}>SALE RECEIPT</Text>
      <View style={styles.refRow}>
        <Text style={styles.refText}>Ref: #{data.activationId.slice(0, 8).toUpperCase()}</Text>
        <Text style={styles.refText}>{fmtDate(data.activationDate)}</Text>
      </View>

      {(data.customerName || data.customerPhone) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          {data.customerName && (
            <View style={styles.row}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{data.customerName}</Text>
            </View>
          )}
          {data.customerPhone && (
            <View style={styles.row}>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{data.customerPhone}</Text>
            </View>
          )}
          {data.customerCnic && (
            <View style={styles.row}>
              <Text style={styles.label}>CNIC</Text>
              <Text style={styles.value}>{data.customerCnic}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Item</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Model</Text>
          <Text style={styles.value}>{data.modelName}</Text>
        </View>
        {data.imei && (
          <View style={styles.row}>
            <Text style={styles.label}>IMEI</Text>
            <Text style={styles.value}>{data.imei}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>{fmtDate(data.activationDate)}</Text>
        </View>
      </View>

      <View style={styles.totalBox}>
        <Text style={styles.totalLabel}>Total Amount</Text>
        <Text style={styles.totalValue}>{fmt(data.dealerPrice)}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Thank you for your purchase!</Text>
        <Text style={styles.footerText}>Alhamd Sales Console</Text>
      </View>
    </Page>
  </Document>
);

export async function buildReceipt(data: ReceiptData): Promise<Buffer> {
  return renderToBuffer(<ReceiptDocument data={data} />) as Promise<Buffer>;
}
