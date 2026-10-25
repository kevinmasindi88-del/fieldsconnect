import { PolicyDocument, type PolicySection } from "@/components/legal/PolicyDocument";

const sections: readonly PolicySection[] = [
  {
    id:"responsible-party", heading:"Who is responsible for your information",
    paragraphs:[
      "FieldsConnect is the South African business operating fieldsconnect.app and is the responsible party for personal information collected and used to operate its own platform, except where another party independently determines the purpose and means of processing. References to we, us and our mean that operating business.",
      "This notice applies to visitors, registered members, mentors, mentees and persons whose information is contained in reports or materials uploaded to FieldsConnect. It should be read with the Terms of Use and Community Guidelines.",
      "For enquiries about this Privacy Policy or the processing of your information, contact FieldsConnect through its Feedback and support facility. Requests concerning personal information are directed to the appropriate privacy contact for handling."
    ]
  },
  {
    id:"what-we-collect", heading:"Personal information collected",
    paragraphs:[
      "Depending on features you use, we may collect registration details (email address and authentication/account identifiers); profile details (display name, username, photo, field, study or career level, biography, skills and experience); and mentorship details (offers, requests, objectives, communications, plans, milestones, reviews and completion feedback).",
      "We may also process posts, reactions, comments, connections, uploaded files, notifications, support requests, moderation reports and appeal evidence, and transaction references if paid features are enabled. Some uploads or free-text fields may inadvertently include personal information about other people. Please share only information you are authorised to provide."
    ]
  },
  {
    id:"automatically-collected", heading:"Technical and usage information",
    paragraphs:[
      "We and our infrastructure providers may process technical information needed to deliver, secure and diagnose the service, such as browser/device characteristics, IP-related network data, timestamps, sign-in events, application errors, session identifiers and platform usage records.",
      "Technical data supports account access, platform security, service reliability and usage analysis. Optional push notifications, where available and enabled by a member, use notification subscription information. We explain any additional tracking or analytics uses where required."
    ]
  },
  {
    id:"source", heading:"Where information comes from",
    paragraphs:[
      "Information generally comes from you when registering, completing your profile, posting, applying to a mentor, uploading resources or contacting support. Other members may generate information about you through connection requests, reviews or reports. Payment and infrastructure providers may supply confirmation, fraud or operational records needed to deliver a service.",
      "We do not treat a self-entered age, qualification, institution or professional designation as independently verified simply because it appears in a profile."
    ]
  },
  {
    id:"why", heading:"Purposes for which we use it",
    paragraphs:[
      "We use information to register and secure accounts, connect members, deliver posts and messaging, support mentorship, facilitate agreed sharing, deliver notifications, respond to enquiries, moderate misconduct, prevent fraud, operate payments when available, keep appropriate records and meet legal duties.",
      "We may review aggregated or de-identified product metrics to identify what helps learners and mentors succeed and to improve the service. Where possible, reports used for product improvement are minimised, aggregated or de-identified."
    ]
  },
  {
    id:"lawful-bases", heading:"Lawful grounds for processing",
    paragraphs:[
      "We assess processing against the applicable grounds in POPIA, including consent where required, steps necessary to enter or perform an agreement, compliance with legal duties, protection of legitimate interests of the data subject and pursuit of legitimate interests of FieldsConnect or recipients in the manner permitted by law.",
      "Acceptance of the platform Terms does not remove your privacy rights. Where separate consent is legally required, including for certain marketing or children's information, it is addressed under the applicable legal requirements."
    ]
  },
  {
    id:"required-optional", heading:"Required and optional information",
    paragraphs:[
      "A name, email address, career or educational category, field of interest and authentication information are required to register a FieldsConnect account. Other profile fields, biography, avatar, skills, optional resources and many community interactions are voluntary. We indicate required input in the interface where practical.",
      "Declining optional information can limit matching, discovery or certain features but does not automatically prevent access to unrelated functions. A failure to provide essential information or lawful authorisation may prevent us from opening an account or supplying the requested service."
    ]
  },
  {
    id:"children", heading:"Children and younger learners",
    paragraphs:[
      "FieldsConnect aims to benefit learners at different educational levels, including talented young students. South Africa's POPIA places special restrictions on processing the personal information of children. Processing children's information is subject to the lawful permissions and safeguards required in the circumstances, which may include consent from a legally competent parent or guardian.",
      "Where parental or guardian permission is legally necessary, it must be obtained independently of ordinary account registration. FieldsConnect may limit account access or relevant interactions where additional lawful permissions or safety safeguards are required.",
      "Age-appropriate measures may include limits on profile visibility, direct contact or off-platform solicitation, as well as guardian or educational-institution involvement in certain mentorship activities. Access to features may be restricted when adequate safeguards or legally required permissions are not in place."
    ]
  },
  {
    id:"public-visibility", heading:"Profile and post visibility",
    paragraphs:[
      "A public profile or public post may be visible to people outside your connection network, subject to the current interface and access controls. Connections-only content is intended for eligible connected members, while private information is handled under applicable access rules. Public material may be copied, screenshotted or redistributed by others beyond FieldsConnect's direct control.",
      "Before posting, review the audience of your content. Do not disclose home addresses, identification numbers, school timetables, live locations, bank details, medical records or details about children in community feeds."
    ]
  },
  {
    id:"direct-messages", heading:"Messages and mentoring materials",
    paragraphs:[
      "Direct messages, mentorship workspaces, plans, evidence, shared documents and library items are processed to deliver interactions requested by participating users. Visibility depends on their feature-specific rules and selected sharing controls.",
      "Authorised FieldsConnect personnel may access information relevant to a reported safety concern, dispute, technical issue or lawful request. Access is limited to the purpose of the enquiry and governed by applicable privacy and confidentiality obligations."
    ]
  },
  {
    id:"ratings", heading:"Ratings, written reviews and consent to publish",
    paragraphs:[
      "Completed mentorships may generate star ratings and aggregate scores. Where the feature supports a choice, a written review and the reviewer's identity are only displayed publicly according to the publication preferences selected by that reviewer. A star rating may be shown without an accompanying public comment.",
      "Moderation or fraud investigations may use the underlying relevant transaction or mentorship record to investigate authenticity and misconduct, even where written feedback was not made public."
    ]
  },
  {
    id:"payments", heading:"Payments and payouts",
    paragraphs:[
      "Where paid mentorship is offered, FieldsConnect and the identified payment provider may process order references, price, payment status, settlement details, refund information and related transaction records necessary to provide the service.",
      "Members should not share card details, banking credentials or one-time security codes through posts, direct messages or profile fields. Payment providers process relevant financial data under their applicable privacy notices and service terms."
    ]
  },
  {
    id:"sharing", heading:"With whom information may be shared",
    paragraphs:[
      "We share necessary information with other users according to your chosen visibility settings or actions, and with the people involved in your requested mentorship or transaction. We may use authorised providers for hosting, database and authentication services, content delivery, notifications, payment services and operational support.",
      "The current application is deployed using Vercel and Supabase infrastructure; Paystack is the intended processor for paid mentorships. Vendors may act as operators or independent responsible parties for their own purposes. We may disclose information when required by law, to respond to a lawful authority or to protect individuals from serious harm.",
      "Connecting with another member does not give that member permission to access or use your private messages, mentorship records or non-public profile information beyond the access made available through FieldsConnect."
    ]
  },
  {
    id:"cross-border", heading:"Storage and transfers outside South Africa",
    paragraphs:[
      "Cloud and payment infrastructure can involve processing or storage outside South Africa. Transfers of personal information outside South Africa are subject to POPIA's cross-border transfer requirements, including applicable safeguards or other lawful grounds.",
      "We do not represent all information as being stored exclusively in South Africa. Processing by international service providers is subject to applicable safeguards and conditions under South African privacy law."
    ]
  },
  {
    id:"security", heading:"Security and access controls",
    paragraphs:[
      "FieldsConnect uses account authentication, access permissions, secure data transmission and database access controls to help protect personal information. We review security measures as the service and associated risks evolve.",
      "No internet service is risk-free. Users should safeguard passwords, avoid suspicious links and promptly report suspected compromise. Do not email or post passwords, recovery tokens, card numbers or full payout credentials to other users."
    ]
  },
  {
    id:"incidents", heading:"Security incidents and breach notifications",
    paragraphs:[
      "If we have reasonable grounds to believe personal information has been accessed or acquired by an unauthorised person, we will assess the incident and notify the Information Regulator and affected data subjects as required by POPIA section 22, subject to lawful exceptions and timing conditions.",
      "Notices, where required, will contain information reasonably available to help affected users protect themselves, including measures taken, potential consequences and recommended protective steps."
    ]
  },
  {
    id:"retention", heading:"Retention and deletion",
    paragraphs:[
      "We retain personal information only as long as necessary for an identified lawful purpose, a legal retention duty, a legitimate dispute or fraud investigation, or another basis allowed by law. The specific period depends on the record: for example, a live account profile differs from a payment audit or moderation decision.",
      "Information is deleted or de-identified when it is no longer needed for a lawful purpose, subject to applicable retention obligations. Removing content from public view may not immediately remove records held for a valid legal, security or backup purpose."
    ]
  },
  {
    id:"accuracy", heading:"Accuracy and user controls",
    paragraphs:[
      "Account holders may update editable profile fields and supported sharing preferences through the application. Information about other users, such as mentorship feedback or moderation evidence, may need independent handling to preserve accuracy and fairness.",
      "We may ask for verification before correcting records that affect another person's rights, access, a completed transaction or regulatory reporting."
    ]
  },
  {
    id:"rights", heading:"Your rights under POPIA",
    paragraphs:[
      "Subject to applicable law, you may ask whether we hold personal information about you, request access or correction, object to certain processing, withdraw consent where consent is the lawful basis, and request deletion or other relief where allowed by POPIA.",
      "You may also complain to South Africa's Information Regulator or seek another lawful remedy. We may require information reasonably necessary to verify an individual's identity before disclosing protected personal information."
    ]
  },
  {
    id:"marketing", heading:"Marketing and communications",
    paragraphs:[
      "FieldsConnect may send essential service messages about account security, requested mentorships, transactions, community-safety decisions and operational updates. Registration does not automatically opt you into unrelated direct electronic marketing.",
      "Where direct marketing requires consent or another lawful ground, we will use the applicable mechanism and provide appropriate opt-out choices. Disabling optional notifications does not necessarily disable essential security notices."
    ]
  },
  {
    id:"cookies", heading:"Cookies and session technology",
    paragraphs:[
      "Authentication and security functions may use session cookies, local browser storage or comparable technical mechanisms to maintain your sign-in, protect access and provide requested services. Browser settings can affect these features.",
      "For non-essential tracking or analytics, we provide information about its purpose and the applicable consent or objection choices where required."
    ]
  },
  {
    id:"automation", heading:"Automated processing and analytics",
    paragraphs:[
      "FieldsConnect may use software to rank or filter search results, surface notifications, enforce configuration rules, detect obvious misuse or calculate aggregated engagement measures. These functions do not amount to a promise of verified professional credentials or guaranteed mentorship outcomes.",
      "Where legally significant decisions involve automated processing, the protections and review rights required by applicable law apply."
    ]
  },
  {
    id:"third-party-data", heading:"Other people's information and special information",
    paragraphs:[
      "Members should not disclose another person's personal information, medical details, children's identifying information, financial details or confidential educational records without a lawful reason and appropriate authority. Professional mentors must comply with applicable confidentiality duties.",
      "Information classified as special personal information under POPIA is subject to additional legal restrictions. We discourage uploading it unless the feature requires it and the necessary lawful grounds, permissions and security measures exist."
    ]
  },
  {
    id:"requests", heading:"Privacy questions, correction and complaints",
    paragraphs:[
      "Privacy and personal-information requests can be submitted through FieldsConnect's Feedback and support facility, with a note that the enquiry concerns privacy. Avoid sharing passwords, unnecessary identification documents or confidential third-party information in general support messages.",
      "You may also contact the Information Regulator of South Africa for information about privacy rights and its complaints procedure at https://inforegulator.org.za/."
    ]
  },
  {
    id:"updates", heading:"Policy changes",
    paragraphs:[
      "We may update this Privacy Policy if the service, legal obligations, processing purposes or third-party providers materially change. Changes will be communicated appropriately, with a new version or effective date where relevant. If a new purpose requires consent, we will seek it rather than relying on an unrelated historical signup tick."
    ]
  },
];

export default function PrivacyPolicyPage() {
  return (
    <PolicyDocument
      title="Privacy Policy"
      version="2026-10-24-v1"
      summary="How FieldsConnect collects, uses, shares, retains and protects information across accounts, mentorship, community features and support."
      sections={sections}
      footer={<p>For a privacy enquiry, signed-in users can use the <a className="font-semibold text-blue-700 underline" href="/feedback">Feedback centre</a> and mark the message for the Information Officer. Regulatory guidance is available from <a className="font-semibold text-blue-700 underline" href="https://inforegulator.org.za/" target="_blank" rel="noopener noreferrer">South Africa's Information Regulator</a>.</p>}
    />
  );
}
