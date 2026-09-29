import { Link } from "wouter";
import { ShieldCheck } from "lucide-react";

const sectionClassName = "space-y-3";
const headingClassName = "text-xl font-semibold text-foreground";
const paragraphClassName = "text-sm leading-7 text-muted-foreground";

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10 lg:p-12">
        <header className="border-b border-border pb-8">
          <Link href="/sign-in" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            <ShieldCheck className="h-5 w-5" />
            MimoSaaS
          </Link>
          <h1 className="mt-5 text-3xl font-bold text-foreground sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">Effective date: September 29, 2026</p>
        </header>

        <div className="mt-8 space-y-9">
          <section className={sectionClassName}>
            <h2 className={headingClassName}>1. About this policy</h2>
            <p className={paragraphClassName}>
              MimoSaaS is a marketing analytics service that lets organisations connect marketing and business data,
              monitor campaign performance, create reports, and receive performance alerts. This policy explains how
              MimoSaaS ("we", "us", or "our") collects, uses, stores, and shares information when you use
              mimosaas.app and its related services.
            </p>
          </section>

          <section className={sectionClassName}>
            <h2 className={headingClassName}>2. Information we collect</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
              <li><strong className="text-foreground">Account information:</strong> your name, email address, user identifier, and authentication information provided through our identity provider.</li>
              <li><strong className="text-foreground">Workspace information:</strong> client names, campaign details, budgets, targets, benchmarks, reports, alert settings, and information you upload or enter.</li>
              <li><strong className="text-foreground">Connected-service information:</strong> account and property identifiers, campaign data, analytics metrics, advertising metrics, ecommerce or CRM data, and spreadsheet data that you authorise us to access.</li>
              <li><strong className="text-foreground">Technical information:</strong> IP address, browser and device information, session data, security events, and application logs.</li>
              <li><strong className="text-foreground">Communications:</strong> support requests, report recipients, alert recipients, and messages you submit through service features.</li>
            </ul>
          </section>

          <section className={sectionClassName}>
            <h2 className={headingClassName}>3. Google user data</h2>
            <p className={paragraphClassName}>
              When you connect a Google account, MimoSaaS requests the access needed for the feature you select.
              Google Analytics and Google Sheets use read-only access. For Google Analytics, this includes your Google
              account email address, accessible Analytics accounts and properties, and GA4 reporting data such as
              sessions, users, conversions, engagement, campaign attribution, and revenue metrics. For Google Sheets,
              this may include spreadsheet and file metadata and the contents of sheets you select. Google Ads uses
              Google&apos;s advertising API scope to list accessible accounts and retrieve reporting data for the accounts
              and campaigns you select.
            </p>
            <p className={paragraphClassName}>
              We use Google user data to connect the source you requested, import and refresh campaign metrics, calculate
              campaign performance, display dashboards, evaluate KPIs and benchmarks, create alerts, and generate reports.
              We store OAuth credentials, selected-source settings, imported metrics, and derived analytics for as long as
              needed to maintain the connection and provide these features.
            </p>
            <p className={paragraphClassName}>
              Google user data is visible only to authorised users of the relevant MimoSaaS workspace and to service
              providers that process data for us as necessary to operate the service. MimoSaaS does not sell Google user
              data or use it for advertising.
            </p>
            <p className={paragraphClassName}>
              MimoSaaS&apos;s use and transfer of information received from Google APIs adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Google API Services User Data Policy
              </a>, including its Limited Use requirements.
            </p>
          </section>

          <section className={sectionClassName}>
            <h2 className={headingClassName}>4. How we use information</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
              <li>Provide, maintain, secure, and troubleshoot MimoSaaS.</li>
              <li>Authenticate users and enforce workspace and campaign access.</li>
              <li>Import, organise, analyse, and present connected campaign data.</li>
              <li>Generate dashboards, reports, and notifications.</li>
              <li>Send service messages, scheduled reports, and alerts configured by users.</li>
              <li>Prevent misuse, comply with legal obligations, and protect our users and service.</li>
            </ul>
          </section>

          <section className={sectionClassName}>
            <h2 className={headingClassName}>5. How we share information</h2>
            <p className={paragraphClassName}>We may share information only in these circumstances:</p>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
              <li>With authorised members of your organisation or workspace.</li>
              <li>With vendors that provide authentication, hosting, database, email delivery, security, and support services on our behalf.</li>
              <li>With connected platforms when you direct MimoSaaS to authenticate, retrieve, refresh, or send data.</li>
              <li>When required by law or necessary to protect rights, safety, and service integrity.</li>
              <li>As part of a merger, acquisition, financing, or sale, subject to appropriate confidentiality and notice requirements.</li>
            </ul>
            <p className={paragraphClassName}>We do not sell personal information or connected-source data.</p>
          </section>

          <section className={sectionClassName}>
            <h2 className={headingClassName}>6. Retention and deletion</h2>
            <p className={paragraphClassName}>
              We retain information while your account, campaign, or source connection is active and as needed to provide
              the service. We may retain limited security, audit, delivery, backup, and legal records for legitimate
              operational or legal purposes. You can disconnect a source to stop future access, delete campaigns or
              clients using available product controls, or contact us to request deletion of your account and associated
              personal data. We will process verified deletion requests subject to legal and security retention needs.
            </p>
          </section>

          <section className={sectionClassName}>
            <h2 className={headingClassName}>7. Your choices and rights</h2>
            <p className={paragraphClassName}>
              Depending on where you live, you may have rights to access, correct, delete, restrict, object to, or receive
              a copy of your personal data, and to withdraw consent. You can revoke MimoSaaS&apos;s Google access from your{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Google Account permissions
              </a>. Revoking access stops future Google API access but does not automatically delete data already imported
              into MimoSaaS; contact us or use the available deletion controls for deletion requests.
            </p>
          </section>

          <section className={sectionClassName}>
            <h2 className={headingClassName}>8. Security and international processing</h2>
            <p className={paragraphClassName}>
              We use administrative, technical, and organisational safeguards designed to protect information. No online
              service can guarantee absolute security. MimoSaaS and its service providers may process information in
              countries other than your own, using legally required safeguards where applicable.
            </p>
          </section>

          <section className={sectionClassName}>
            <h2 className={headingClassName}>9. Children</h2>
            <p className={paragraphClassName}>
              MimoSaaS is a business service and is not directed to children under 16. We do not knowingly collect
              personal information from children under 16.
            </p>
          </section>

          <section className={sectionClassName}>
            <h2 className={headingClassName}>10. Changes to this policy</h2>
            <p className={paragraphClassName}>
              We may update this policy when our service or legal obligations change. We will update the effective date
              and provide additional notice when required.
            </p>
          </section>

          <section className={sectionClassName}>
            <h2 className={headingClassName}>11. Contact us</h2>
            <p className={paragraphClassName}>
              For privacy questions, rights requests, or deletion requests, email{" "}
              <a href="mailto:alerts@mimosaas.app" className="font-medium text-primary hover:underline">
                alerts@mimosaas.app
              </a>.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
