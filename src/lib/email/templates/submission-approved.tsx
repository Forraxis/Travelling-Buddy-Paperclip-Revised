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
} from '@react-email/components';
import * as React from 'react';

interface SubmissionApprovedEmailProps {
  entityName: string;
  catalogueUrl: string;
  siteUrl: string;
}

export function SubmissionApprovedEmail({
  entityName,
  catalogueUrl,
  siteUrl,
}: SubmissionApprovedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your submission for {entityName} has been approved!</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Submission Approved 🎉</Heading>
          <Text style={text}>
            Great news! Your submission for <strong>{entityName}</strong> has
            been reviewed and approved by our team.
          </Text>
          <Text style={text}>
            It is now live in the TravellingBuddy catalogue for other travellers
            to discover.
          </Text>
          <Section style={buttonSection}>
            <Button href={`${siteUrl}${catalogueUrl}`} style={button}>
              View Live Entry
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            Thank you for contributing to the TravellingBuddy community. Your
            submissions help fellow travellers make better decisions.
          </Text>
          <Text style={footer}>
            View all your submissions at{' '}
            <a href={`${siteUrl}/account/submissions`}>
              {siteUrl}/account/submissions
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' };
const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '24px',
  borderRadius: '8px',
  maxWidth: '560px',
};
const heading = { fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' };
const text = { fontSize: '16px', color: '#444444', lineHeight: '1.5' };
const buttonSection = { textAlign: 'center' as const, margin: '24px 0' };
const button = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
};
const hr = { borderColor: '#e5e7eb', margin: '24px 0' };
const footer = { fontSize: '13px', color: '#9ca3af' };
