import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { DealerOnboardingProfile } from "@/lib/admin/onboarding";

type CertificateData = {
  businessName: string;
  ownerEmail: string;
  planMonths: number;
  startedAt?: string | null;
  expiresAt?: string | null;
  profile: DealerOnboardingProfile;
};

const fmtDate = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
  },
  header: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 18,
    marginBottom: 18,
  },
  brand: {
    fontSize: 11,
    letterSpacing: 3,
    color: "#475569",
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.6,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 10,
    color: "#475569",
    lineHeight: 1.5,
  },
  rule: {
    marginVertical: 16,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  sectionTitle: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    color: "#64748B",
    marginBottom: 8,
    fontFamily: "Helvetica-Bold",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  box: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    marginBottom: 8,
  },
  label: {
    fontSize: 8,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  value: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.35,
  },
  full: {
    width: "100%",
  },
  docBox: {
    width: "32%",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 10,
    marginBottom: 8,
  },
  docName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  docMeta: {
    fontSize: 8,
    color: "#64748B",
    lineHeight: 1.4,
  },
  footer: {
    marginTop: 22,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  footerText: {
    fontSize: 8,
    color: "#64748B",
  },
  stamp: {
    borderWidth: 1,
    borderColor: "#0F172A",
    paddingVertical: 10,
    paddingHorizontal: 14,
    textAlign: "center",
  },
  stampText: {
    fontSize: 8,
    letterSpacing: 1.5,
    fontFamily: "Helvetica-Bold",
  },
});

export async function buildDealerProfileCertificatePDF(data: CertificateData): Promise<Buffer> {
  const { profile } = data;

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>OPPO PAKISTAN</Text>
          <Text style={styles.title}>Dealer Profile Certificate</Text>
          <Text style={styles.subtitle}>
            This certificate records the registered business profile provided during dealer
            onboarding. It is intended for internal record and verified portal access.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Dealer identity</Text>
        <View style={styles.grid}>
          <View style={styles.box}>
            <Text style={styles.label}>Business name</Text>
            <Text style={styles.value}>{data.businessName}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.label}>Owner name</Text>
            <Text style={styles.value}>{profile.ownerName}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.label}>OPPO dealer ID</Text>
            <Text style={styles.value}>{profile.oppoDealerId}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.label}>City / region</Text>
            <Text style={styles.value}>{profile.cityRegion}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.label}>Mobile number</Text>
            <Text style={styles.value}>{profile.mobileNumber}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.label}>WhatsApp number</Text>
            <Text style={styles.value}>{profile.whatsappNumber}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{profile.email}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.label}>Staff using app</Text>
            <Text style={styles.value}>{profile.staffCount}</Text>
          </View>
          <View style={[styles.box, styles.full]}>
            <Text style={styles.label}>Shop address</Text>
            <Text style={styles.value}>{profile.shopAddress}</Text>
          </View>
        </View>

        <View style={styles.rule} />

        <Text style={styles.sectionTitle}>Document checklist</Text>
        <View style={styles.grid}>
          <View style={styles.docBox}>
            <Text style={styles.docName}>CNIC Front</Text>
            <Text style={styles.docMeta}>{profile.cnicFront.name}</Text>
            <Text style={styles.docMeta}>{profile.cnicFront.type}</Text>
          </View>
          <View style={styles.docBox}>
            <Text style={styles.docName}>CNIC Back</Text>
            <Text style={styles.docMeta}>{profile.cnicBack.name}</Text>
            <Text style={styles.docMeta}>{profile.cnicBack.type}</Text>
          </View>
          <View style={styles.docBox}>
            <Text style={styles.docName}>Tax / NTN / Sales tax certificate</Text>
            <Text style={styles.docMeta}>{profile.taxCertificate.name}</Text>
            <Text style={styles.docMeta}>{profile.taxCertificate.type}</Text>
          </View>
        </View>

        <View style={styles.rule} />

        <Text style={styles.sectionTitle}>Membership summary</Text>
        <View style={styles.grid}>
          <View style={styles.box}>
            <Text style={styles.label}>Dealer login ID</Text>
            <Text style={styles.value}>{data.ownerEmail}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.label}>Plan duration</Text>
            <Text style={styles.value}>{data.planMonths} months</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.label}>Start date</Text>
            <Text style={styles.value}>{fmtDate(data.startedAt)}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.label}>Expiry date</Text>
            <Text style={styles.value}>{fmtDate(data.expiresAt)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View>
            <Text style={styles.footerText}>Issued by OPPO dealer administration</Text>
            <Text style={styles.footerText}>Verified portal profile copy</Text>
          </View>
          <View style={styles.stamp}>
            <Text style={styles.stampText}>AUTHORIZED</Text>
          </View>
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
