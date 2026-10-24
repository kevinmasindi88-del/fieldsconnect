import { PolicyDocument, type PolicySection } from "@/components/legal/PolicyDocument";

const sections: readonly PolicySection[] = [
  {
    id:"responsible-party", heading:"Who is responsible for your information",
    paragraphs:[
      "FieldsConnect is the South African business operating fieldsconnect.app and is the responsible party for personal information collected and used to operate its own platform, except where another party independently determines the purpose and means of processing. References to we, us and our mean that operating business.",
      "This notice applies to visitors, registered members, mentors, mentees and persons whose information is contained in reports or materials uploaded to FieldsConnect. It should be read with the Terms of Use and Community Guidelines.",
      "The company's exact CIPC particulars, business address and publicly reachable Information Officer contact must be confirmed from the registered business record and displayed before this notice is released to Production as the final statutory disclosure."
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
      "We use only the technical records and device permissions necessary for enabled functionality, security, analytics or support. Push notifications, where supported and permissioned, may use device notification subscription details. Specific third-party analytics or advertising tools will require corresponding disclosures if added."
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
      "A single signup agreement is evidence of accepting platform rules, not an all-purpose waiver of privacy rights, not blanket consent for unrelated marketing and not by itself adequate prior consent for a child where POPIA requires consent of a competent person."
    ]
  },
  {
    id:"required-optional", heading:"Required and optional information",
    paragraphs:[
      "Email, authentication information and selected core profile details are ordinarily required to provide an identified account. Other profile fields, biography, avatar, skills, optional resources and many community interactions are voluntary. We indicate required input in the interface where practical.",
      "Declining optional information can limit matching, discovery or certain features but does not automatically prevent access to unrelated functions. A failure to provide essential information or lawful authorisation may prevent us from opening an account or supplying the requested service."
    ]
  },
  {
    id:"children", heading:"Children and younger learners",
    paragraphs:[
      "FieldsConnect aims to benefit learners at different educational levels, including talented young students. South Africa's POPIA places special restrictions on processing the personal information of children. Where a person is under 18, we must determine whether an applicable statutory authorisation exists, which may include prior consent from a legally competent person.",
      "A learner's acceptance of Terms, email confirmation or self-declaration does not prove guardian consent. Where legally required authorisation or adequate safeguards are not available, we may pause onboarding, restrict personal information processing, disable certain interactions, seek appropriate verification or close the account.",
      "Child-safety arrangements may include limiting discoverability, direct contact, location sharing and off-platform solicitation; guardian or school involvement in mentorship; and enhanced moderation. We will not represent proposed safeguards as active until implemented and tested."
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
      "Authorised staff or moderators may need limited access to relevant evidence when a report, safety incident, dispute, technical fault or legal request requires it. Such access should be role-restricted, proportionate, logged where supported and subject to confidentiality requirements."
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
      "If paid mentorship is enabled, we and our authorised payment provider, expected to include Paystack, may process prices, order identifiers, transaction references, outcome, settlement status, refund status, payout-account codes and related audit information. Bank-account entry and transaction collection should take place through designated secured provider workflows.",
      "FieldsConnect should not require members to post full account numbers, card details or secret credentials in profile or message fields. Whether and how the payment provider processes account details is subject to the provider's privacy documents. Paid mentorship checkout remains unavailable until production activation and associated controls are approved."
    ]
  },
  {
    id:"sharing", heading:"With whom information may be shared",
    paragraphs:[
      "We share necessary information with other users according to your chosen visibility settings or actions, and with the people involved in your requested mentorship or transaction. We may use authorised providers for hosting, database and authentication services, content delivery, notifications, payment services and operational support.",
      "The current application is deployed using Vercel and Supabase infrastructure; Paystack is the intended processor for paid mentorships. Vendors may act as operators or independent responsible parties for their own purposes. We may disclose information when required by law, to respond to a lawful authority or to protect individuals from serious harm.",
      "We do not treat a member's decision to connect with another member as permission to sell private profile, message or mentorship data to that person."
    ]
  },
  {
    id:"cross-border", heading:"Storage and transfers outside South Africa",
    paragraphs:[
      "Cloud and payment infrastructure can involve processing or storage outside South Africa. International disclosures and transfers are assessed under POPIA section 72 and relevant protections, including suitable recipient safeguards or other lawful transfer grounds.",
      "Provider location, transfer safeguards and contractual controls must be checked when services are configured or materially changed. We do not promise that every item of information remains physically stored in South Africa."
    ]
  },
  {
    id:"security", heading:"Security and access controls",
    paragraphs:[
      "FieldsConnect seeks to use appropriate technical and organisational measures to protect personal information from loss, unauthorised access, disclosure and alteration. Measures may include authentication, access permissions, row-level database controls, role restrictions, secure transport, moderation safeguards, service monitoring and controlled deployments.",
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
      "When continued retention is unnecessary or unlawful, information should be deleted, destroyed or de-identified in a manner appropriate to the record and applicable requirements. Deletion from a public view may not immediately remove lawfully retained audit or backup copies; access to those copies should remain restricted."
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
      "We may send essential service messages about account security, moderation, requested mentorships, transactions, legal updates and operational changes. We should not treat acceptance of platform Terms as consent to unrelated direct electronic marketing.",
      "Where direct marketing requires consent or another lawful ground, we will use the applicable mechanism and provide appropriate opt-out choices. Disabling optional notifications does not necessarily disable essential security notices."
    ]
  },
  {
    id:"cookies", heading:"Cookies and session technology",
    paragraphs:[
      "Authentication and security functions may use session cookies, local browser storage or comparable technical mechanisms to maintain your sign-in, protect access and provide requested services. Browser settings can affect these features.",
      "If optional tracking, behavioural advertising or non-essential analytics technology is introduced, its purpose, provider and relevant consent or objection choices must be disclosed before deployment where required."
    ]
  },
  {
    id:"automation", heading:"Automated processing and analytics",
    paragraphs:[
      "FieldsConnect may use software to rank or filter search results, surface notifications, enforce configuration rules, detect obvious misuse or calculate aggregated engagement measures. These functions do not amount to a promise of verified professional credentials or guaranteed mentorship outcomes.",
      "We will consider additional legal requirements before deploying solely automated decisions that create significant legal or similarly substantial effects on an individual, and provide meaningful review where the law requires."
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
      "Signed-in users can submit a privacy or access request through the FieldsConnect Feedback centre and identify the request as intended for the Information Officer. Please do not include unnecessary identity-document scans or confidential data in an ordinary feedback request.",
      "The public contact details and company particulars for formal PAIA or POPIA requests must be verified and published before this becomes the final statutory notice. The Information Regulator's official website is https://inforegulator.org.za/ for regulatory information and complaint procedures."
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
