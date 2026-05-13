import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

interface TrustTierPromotedEmailProps {
  newTier: "BASIC" | "TRUSTED";
  siteUrl: string;
}

const TIER_DETAILS: Record<
  "BASIC" | "TRUSTED",
  { label: string; description: string }
> = {
  BASIC: {
    label: "Contributor",
    description:
      "Your first approved submission has earned you Contributor status. " +
      "Your future submissions will be prioritised in the review queue.",
  },
  TRUSTED: {
    label: "Trusted",
    description:
      "Your track record of quality submissions has earned you Trusted status. " +
      "Trusted members are eligible for auto-approval on future submissions, " +
      "meaning your entries can go live without waiting for manual review.",
  },
};

export function TrustTierPromotedEmail({
  newTier,
  siteUrl,
}: TrustTierPromotedEmailProps) {
  const { label, description } = TIER_DETAILS[newTier];

  return (
    <Html>
      <Head />
      <Preview>You have been promoted to {label} on TravellingBuddy!</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>You are now a {label}! 🏆</Heading>
          <Text style={text}>{description}</Text>
          <Hr style={hr} />
          <Text style={footer}>
            View your trust tier status on your{" "}
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
const hr = { borderColor: "#e5e7eb", margin: "24px 0" };
const footer = { fontSize: "13px", color: "#9ca3af" };
