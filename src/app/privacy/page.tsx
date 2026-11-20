import React from "react";
import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | Panchayat WhatsApp CRM",
  description: "Privacy policy and data handling practices for WhatsApp CRM.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Home
        </Link>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Shield className="size-3.5" />
            Official Privacy Statement
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Last Updated: November 20, 2026
          </p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1. Introduction</h2>
            <p className="text-muted-foreground">
              Welcome to the WhatsApp CRM and Grievance Redressal Platform ("we", "our", "us").
              We are committed to protecting the privacy, confidentiality, and security of all
              users, citizens, and stakeholders who interact with our services via WhatsApp and our CRM dashboard.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">2. Information We Collect</h2>
            <p className="text-muted-foreground">
              When citizens or users submit grievances, complaints, or inquiries through WhatsApp, we may collect:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong>Contact Information:</strong> WhatsApp phone number and profile display name.</li>
              <li><strong>Grievance Details:</strong> Messages, issue categories (e.g. water, electricity, roads), village/ward location details, and any images or documents sent by the citizen.</li>
              <li><strong>Metadata:</strong> Timestamp of messages, delivery status, and ticket identifiers.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3. How We Use Information</h2>
            <p className="text-muted-foreground">
              The collected information is used solely for the following purposes:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Directing and routing complaints to the designated local department or officer.</li>
              <li>Sending automated updates, status confirmations, and resolution notifications to the citizen on WhatsApp.</li>
              <li>Internal record-keeping, tracking public issue resolution times, and service analytics.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">4. WhatsApp & Meta Cloud API Compliance</h2>
            <p className="text-muted-foreground">
              Our service interacts with the Meta WhatsApp Cloud API in full compliance with Meta Platform Terms
              and WhatsApp Business policies. User authentication tokens and message payloads are encrypted
              using AES-256-GCM encryption. We do not sell, rent, or trade personal data to third parties or advertisers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">5. Data Retention & Security</h2>
            <p className="text-muted-foreground">
              We implement industry-standard technical safeguards, including Row-Level Security (RLS), HMAC webhook
              signature verification, and access controls to protect user data from unauthorized access, alteration, or disclosure.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">6. Contact Us</h2>
            <p className="text-muted-foreground">
              For any questions, concerns, or requests regarding this Privacy Policy, please contact the administrative desk or team administrator via the platform.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-border text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} WhatsApp CRM Grievance Redressal. All rights reserved.
        </div>
      </div>
    </div>
  );
}
