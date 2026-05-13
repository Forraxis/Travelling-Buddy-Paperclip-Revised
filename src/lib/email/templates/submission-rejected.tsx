import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface SubmissionRejectedEmailProps {
  entityName: string;
  rejectionReason: string | null;
  editUrl: string;
  siteUrl: string;
}

export function SubmissionRejectedEmail({
  entityName,
  rejectionReason,
  editUrl,
  siteUrl,
}: SubmissionRejectedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Update needed for your {entityName} submission</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Submission Needs Attention</Heading>
          <Text style={text}>
            Thank you for your submission for <strong>{entityName}</strong>.
            After review, our team was unable to approve it at this time.
          </Text>
          {rejectionReason && (
            <Section style={reasonBox}>
              <Text style={reasonLabel}>Reason from reviewer:</Text>
              <Text style={reasonText}>{rejectionReason}</Text>
            </Section>
          )}
          <Text style={text}>
            You are welcome to edit your submission and resubmit it once you
            have addressed the feedback above.
          </Text>
          <Section style={buttonSection}>
            <Button href={`${siteUrl}${editUrl}`} style={button}>
              Edit &amp; Resubmit
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            If you have questions about this decision, please visit your{" "}
            <a href={`${siteUrl}/account/submissions`}>submissions page</a>.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: "#f6f9fc", fontFamily: "sans-serif" };
const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "24px",
  borderRadius: "8px",
  maxWidth: "560px",
};
const heading = { fontSize: "24px", fontWeight: "bold", color: "#1a1a1a" };
const text = { fontSize: "16px", color: "#444444", lineHeight: "1.5" };
const reasonBox = {
  backgroundColor: "#fef3c7",
  borderLeft: "4px solid #f59e0b",
  padding: "12px 16px",
  borderRadius: "4px",
  margin: "16px 0",
};
const reasonLabel = { fontSize: "13px", color: "#92400e", fontWeight: "bold", margin: "0 0 4px" };
const reasonText = { fontSize: "15px", color: "#78350f", margin: "0" };
const buttonSection = { textAlign: "center" as const, margin: "24px 0" };
const button = {
  backgroundColor: "#2563eb",
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "6px",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
};
const hr = { borderColor: "#e5e7eb", margin: "24px 0" };
const footer = { fontSize: "13px", color: "#9ca3af" };
