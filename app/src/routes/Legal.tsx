import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../lib/icons';
import { COMPANY, LEGAL_UPDATED } from '../lib/company';
import type { Lang } from '../lib/i18n';

/*
  The three documents a store will not review an app without.

  They render outside the signed-in shell on purpose. A Play reviewer opens the
  privacy URL in a browser with no account, and a client who has already deleted
  theirs still has to be able to read what happened to their data. Both languages
  are here because both are spoken by the people whose figures these are — a
  policy nobody can read is not a policy.

  Nothing on these pages fetches anything. They are static text and they load
  even when the database is down.
*/

type Block =
  | { h: string }
  | { p: string }
  | { list: string[] };

interface Doc {
  title: string;
  lede: string;
  blocks: Block[];
}

const PRIVACY: Record<Lang, Doc> = {
  en: {
    title: 'Privacy policy',
    lede: `How ${COMPANY.product} handles the information you put into it.`,
    blocks: [
      { h: 'Who we are' },
      {
        p: `${COMPANY.product} is operated by ${COMPANY.name}, registered in ${COMPANY.jurisdiction}. We are the controller of the information described below. You can reach us at ${COMPANY.supportEmail}.`,
      },

      { h: 'What we collect' },
      { p: 'Only what the app needs to do its job:' },
      {
        list: [
          'Your account — the email address you sign up with, your display name, and your chosen language and appearance.',
          'Your business — its name, type, city, country and currency, and the names of the staff you add.',
          'Your figures — products and prices, opening and closing counts, money collected, expenses, losses, staff debts and the notes written against them.',
          'A phone number, if you give one, so that daily summaries and payment prompts can reach you.',
          'Payment records — the reference, amount, mobile-money number used and the outcome, when you pay a subscription. We never see or store your PIN.',
          'Support messages — anything you write to us through Get help, and our replies.',
          'A record of actions taken in the app: who changed what, and when. This is what makes a closing auditable.',
        ],
      },

      { h: 'What we do not collect' },
      {
        list: [
          'We do not track you across other apps or websites.',
          'We do not use advertising identifiers, and we do not sell or rent your data to anyone.',
          'We do not read your contacts, your photos, your location, or your messages.',
          'We do not store card numbers or mobile-money PINs.',
        ],
      },

      { h: 'Why we hold it' },
      {
        p: 'To run the service you signed up for: to show you your own numbers, to let your staff submit a day and you approve it, to produce reports, to bill your subscription, and to answer you when you ask us something. We also keep enough to keep the service secure and to meet the record-keeping obligations of a business in ' + COMPANY.jurisdiction + '.',
      },

      { h: 'Who else sees it' },
      { p: 'A small, named list, and each one only for the part it does:' },
      {
        list: [
          'Supabase — hosting, database and authentication. Your data is stored on their infrastructure.',
          'Payme Africa — payment processing, when you pay a subscription. They receive the amount, the reference and the mobile-money number.',
          'Textify — SMS delivery, if you switch on text alerts. They receive the number and the message.',
          'Resend — email delivery, for reports and account email.',
          'Our own staff at ' + COMPANY.name + ', where support or a fault genuinely requires it. Every such access is written to an audit record.',
        ],
      },
      {
        p: 'We do not give your figures to anyone else. Not to your suppliers, not to your competitors, not to a data broker. If a lawful order ever compelled us to hand something over, we would tell you unless the order forbade it.',
      },

      { h: 'Your staff' },
      {
        p: 'When you add a member of staff, you are entering their name into our service, and you are responsible for having told them. A staff account sees the day it is counting and the entries it records. It does not see profit, and it does not see the other businesses in your account.',
      },

      { h: 'How long we keep it' },
      {
        p: 'For as long as your account exists. Delete your account and we destroy it — your businesses, products, closings, ledger entries, staff records, support threads and action history all go with it, permanently and without a recycle bin. Payment records are kept as accounting records, stripped of anything that identifies you beyond the transaction itself.',
      },

      { h: 'Deleting your account' },
      {
        p: `In the app: Manage → Delete my account. From anywhere: ${COMPANY.site}/legal/delete-account, or email ${COMPANY.supportEmail} from the address you signed up with. It is done within 30 days and usually immediately.`,
      },

      { h: 'Your rights' },
      {
        p: 'You can see everything we hold about you from inside the app, and export your stock and reports as CSV or PDF at any time. You can correct anything that is wrong. You can ask us for a copy, or ask us to delete it. Write to ' + COMPANY.supportEmail + ' and we will answer within 30 days.',
      },

      { h: 'Security' },
      {
        p: 'Everything travels over HTTPS. Every table enforces row-level security in the database itself, so one business cannot read another’s rows even if the app asked it to. Passwords are hashed and we never see them. We are not going to claim a breach is impossible — nobody honest does — but if one happened we would tell you and the regulator without waiting to be asked.',
      },

      { h: 'Children' },
      { p: `${COMPANY.product} is a tool for running a business and is not intended for anyone under 18.` },

      { h: 'Changes' },
      {
        p: 'If we change this policy in a way that matters, we will say so in the app rather than quietly editing the page. The date at the top of this page is when it last changed.',
      },
    ],
  },
  sw: {
    title: 'Sera ya faragha',
    lede: `Jinsi ${COMPANY.product} inavyoshughulikia taarifa unazoweka ndani yake.`,
    blocks: [
      { h: 'Sisi ni nani' },
      {
        p: `${COMPANY.product} inaendeshwa na ${COMPANY.name}, iliyosajiliwa ${COMPANY.jurisdiction}. Sisi ndio wasimamizi wa taarifa zilizoelezwa hapa. Tupate kwa ${COMPANY.supportEmail}.`,
      },

      { h: 'Tunakusanya nini' },
      { p: 'Kile tu kinachohitajika ili programu ifanye kazi yake:' },
      {
        list: [
          'Akaunti yako — barua pepe unayojisajili nayo, jina lako, lugha na mwonekano uliochagua.',
          'Biashara yako — jina, aina, mji, nchi na sarafu, pamoja na majina ya wafanyakazi unaowaongeza.',
          'Takwimu zako — bidhaa na bei, hesabu za kufungua na kufunga, pesa zilizokusanywa, matumizi, hasara, madeni ya wafanyakazi na maelezo yaliyoandikwa.',
          'Namba ya simu, ukitoa, ili muhtasari wa kila siku na maombi ya malipo yakufikie.',
          'Kumbukumbu za malipo — rejea, kiasi, namba ya simu iliyotumika na matokeo, unapolipia kifurushi. Hatuoni wala kuhifadhi PIN yako.',
          'Ujumbe wa msaada — chochote unachotuandikia kupitia Pata msaada, na majibu yetu.',
          'Kumbukumbu ya vitendo ndani ya programu: nani alibadilisha nini, na lini. Hii ndiyo inayofanya kufunga kuweze kukaguliwa.',
        ],
      },

      { h: 'Tusichokusanya' },
      {
        list: [
          'Hatukufuatilii kwenye programu au tovuti nyingine.',
          'Hatutumii vitambulisho vya matangazo, na hatuuzi wala kukodisha taarifa zako kwa yeyote.',
          'Hatusomi anwani zako, picha zako, mahali ulipo, wala ujumbe wako.',
          'Hatuhifadhi namba za kadi wala PIN za pesa za simu.',
        ],
      },

      { h: 'Kwa nini tunazihifadhi' },
      {
        p: 'Ili kuendesha huduma uliyojisajili: kukuonyesha takwimu zako, kuwezesha wafanyakazi kuwasilisha siku na wewe kuidhinisha, kutengeneza ripoti, kutoza kifurushi chako, na kukujibu unapouliza. Pia tunahifadhi kiasi cha kutosha kulinda usalama wa huduma na kutimiza matakwa ya kumbukumbu za biashara ' + COMPANY.jurisdiction + '.',
      },

      { h: 'Nani mwingine anaziona' },
      { p: 'Orodha fupi yenye majina, kila mmoja kwa kazi yake tu:' },
      {
        list: [
          'Supabase — seva, hifadhidata na uthibitisho. Taarifa zako zinahifadhiwa kwenye miundombinu yao.',
          'Payme Africa — kushughulikia malipo unapolipia kifurushi. Wanapokea kiasi, rejea na namba ya simu.',
          'Textify — kutuma SMS, ukiwasha arifa za ujumbe. Wanapokea namba na ujumbe.',
          'Resend — kutuma barua pepe za ripoti na akaunti.',
          'Wafanyakazi wetu wa ' + COMPANY.name + ', pale msaada au hitilafu inapolazimu. Kila upatikanaji kama huo unaandikwa kwenye kumbukumbu ya ukaguzi.',
        ],
      },
      {
        p: 'Hatutoi takwimu zako kwa mtu mwingine. Si kwa wasambazaji wako, si kwa washindani wako, si kwa mfanyabiashara wa data. Kama amri halali ingetulazimu kutoa kitu, tungekuambia isipokuwa amri hiyo ikatuzuia.',
      },

      { h: 'Wafanyakazi wako' },
      {
        p: 'Unapomwongeza mfanyakazi, unaweka jina lake kwenye huduma yetu, na ni jukumu lako kuwa umemweleza. Akaunti ya mfanyakazi inaona siku inayohesabu na maingizo inayorekodi. Haioni faida, wala haioni biashara nyingine ndani ya akaunti yako.',
      },

      { h: 'Tunazihifadhi kwa muda gani' },
      {
        p: 'Kwa muda wote akaunti yako ipo. Futa akaunti na tunaziharibu — biashara, bidhaa, kufunga, maingizo ya leja, wafanyakazi, mazungumzo ya msaada na historia ya vitendo vyote vinaondoka, kabisa na bila pipa la kurudisha. Kumbukumbu za malipo zinabaki kama kumbukumbu za hesabu, bila kitu kinachokutambulisha zaidi ya muamala wenyewe.',
      },

      { h: 'Kufuta akaunti yako' },
      {
        p: `Ndani ya programu: Simamia → Futa akaunti yangu. Kutoka popote: ${COMPANY.site}/legal/delete-account, au tuma barua pepe ${COMPANY.supportEmail} kutoka anwani uliyojisajili nayo. Inakamilika ndani ya siku 30 na mara nyingi papo hapo.`,
      },

      { h: 'Haki zako' },
      {
        p: 'Unaweza kuona kila tulichonacho kuhusu wewe ndani ya programu, na kupakua bidhaa na ripoti zako kama CSV au PDF wakati wowote. Unaweza kurekebisha kisicho sahihi. Unaweza kuomba nakala, au kuomba tufute. Andika ' + COMPANY.supportEmail + ' na tutajibu ndani ya siku 30.',
      },

      { h: 'Usalama' },
      {
        p: 'Kila kitu kinasafiri kwa HTTPS. Kila jedwali linasimamia usalama wa safu ndani ya hifadhidata yenyewe, hivyo biashara moja haiwezi kusoma safu za nyingine hata programu ingeomba. Manenosiri yanafichwa kwa hashi na hatuyaoni. Hatutadai kuwa uvunjifu hauwezekani — hakuna mkweli anayedai hivyo — lakini ukitokea tungekuambia wewe na mdhibiti bila kusubiri kuulizwa.',
      },

      { h: 'Watoto' },
      { p: `${COMPANY.product} ni zana ya kuendesha biashara na haikusudiwi kwa mtu chini ya miaka 18.` },

      { h: 'Mabadiliko' },
      {
        p: 'Tukibadilisha sera hii kwa namna inayohusu, tutasema ndani ya programu badala ya kuhariri ukurasa kimyakimya. Tarehe iliyo juu ya ukurasa huu ni ya mabadiliko ya mwisho.',
      },
    ],
  },
};

const TERMS: Record<Lang, Doc> = {
  en: {
    title: 'Terms of service',
    lede: `The agreement between you and ${COMPANY.name} for using ${COMPANY.product}.`,
    blocks: [
      { h: 'The agreement' },
      {
        p: `By creating an account you agree to these terms. ${COMPANY.product} is provided by ${COMPANY.name}, registered in ${COMPANY.jurisdiction}. If you are accepting on behalf of a business, you confirm you are allowed to.`,
      },

      { h: 'Your account' },
      {
        list: [
          'One account, one owner. Keep your password to yourself — anything done with your password counts as done by you.',
          'You must be 18 or over and running a real business.',
          'The staff you add work under your account. What they do in it is your responsibility.',
          'Give us an email address that works. It is how we reach you about your bill and your data.',
        ],
      },

      { h: 'Your data is yours' },
      {
        p: 'Every figure you enter belongs to you. We hold it to run the service and for nothing else. You can export it at any time, and you can take it and go. We claim no ownership of your stock, your prices, your takings or your reports.',
      },

      { h: 'What we charge' },
      {
        list: [
          'Every account starts with a 14-day free trial. No payment is needed to start.',
          'After the trial, a subscription is charged per account, not per business, and the plan you need is decided by how many businesses you run.',
          'Subscriptions renew for the period you paid for. There is no automatic re-charge without a prompt you approve on your phone.',
          'Prices are set in US dollars and charged in your local currency at the rate shown when you pay.',
          'Payment inside the mobile app is not available. Manage your subscription on the web, or ask us through Get help.',
        ],
      },

      { h: 'If you stop paying' },
      {
        p: 'When a subscription lapses, the businesses in the account are suspended: you cannot record or close a day until it is settled. Your data is not deleted. Pay and everything comes back exactly as it was. If an account stays lapsed for a long time we will write to you before doing anything further, and we will never delete your books without telling you first.',
      },

      { h: 'What you may not do' },
      {
        list: [
          'Do not use the service to record or facilitate anything unlawful.',
          'Do not attempt to reach another client’s data, probe the platform, or work around the limits of your plan.',
          'Do not resell or rebrand the service as your own without a written agreement with us.',
          'Do not upload anything that is not yours to upload.',
        ],
      },

      { h: 'What we owe you' },
      {
        p: 'We will run the service with reasonable care and skill, keep your data where we said we would, and tell you when something goes wrong. We do not promise the service will never be unavailable. Mobile money goes down; networks go down; so do we occasionally.',
      },

      { h: 'What we do not promise' },
      {
        p: 'The service is provided as it is. It records the figures you enter and does arithmetic on them — it does not verify that what you counted is what is on the shelf, and it is not accounting, tax or legal advice. The numbers it produces are only as good as the numbers put in. Check your own books before you rely on them for anything that matters.',
      },

      { h: 'Liability' },
      {
        p: 'To the extent the law allows, our total liability to you for any claim is limited to what you paid us in the twelve months before the claim. We are not liable for lost profit, lost business or lost data beyond that. Nothing here limits liability for fraud or for anything that cannot lawfully be limited.',
      },

      { h: 'Ending it' },
      {
        p: 'You can close your account whenever you want, from Manage → Delete my account. It takes effect immediately and it is permanent. We can suspend or close an account that breaks these terms, and we will say why. If we ever shut the service down, we will give you at least 60 days and a way to take your data with you.',
      },

      { h: 'Law' },
      { p: `These terms are governed by the law of ${COMPANY.jurisdiction}.` },

      { h: 'Contact' },
      { p: `${COMPANY.supportEmail}, or Get help inside the app.` },
    ],
  },
  sw: {
    title: 'Masharti ya huduma',
    lede: `Makubaliano kati yako na ${COMPANY.name} kuhusu kutumia ${COMPANY.product}.`,
    blocks: [
      { h: 'Makubaliano' },
      {
        p: `Kwa kufungua akaunti unakubali masharti haya. ${COMPANY.product} inatolewa na ${COMPANY.name}, iliyosajiliwa ${COMPANY.jurisdiction}. Kama unakubali kwa niaba ya biashara, unathibitisha una ruhusa.`,
      },

      { h: 'Akaunti yako' },
      {
        list: [
          'Akaunti moja, mmiliki mmoja. Weka nenosiri lako kwako — chochote kilichofanywa na nenosiri lako kinahesabiwa kuwa umefanya wewe.',
          'Lazima uwe na miaka 18 au zaidi na uendeshe biashara halisi.',
          'Wafanyakazi unaowaongeza wanafanya kazi chini ya akaunti yako. Wanachofanya ni jukumu lako.',
          'Tupe barua pepe inayofanya kazi. Ndiyo njia tunayokufikia kuhusu bili na taarifa zako.',
        ],
      },

      { h: 'Takwimu zako ni zako' },
      {
        p: 'Kila takwimu unayoweka ni yako. Tunaishikilia ili kuendesha huduma na si kingine. Unaweza kuipakua wakati wowote, na unaweza kuichukua na kuondoka. Hatudai umiliki wa bidhaa zako, bei zako, mapato yako wala ripoti zako.',
      },

      { h: 'Tunatoza nini' },
      {
        list: [
          'Kila akaunti inaanza na siku 14 za majaribio bure. Hakuna malipo yanayohitajika kuanza.',
          'Baada ya majaribio, kifurushi kinatozwa kwa akaunti, si kwa biashara, na kifurushi unachohitaji kinaamuliwa na idadi ya biashara unazoendesha.',
          'Vifurushi vinaendelea kwa kipindi ulicholipia. Hakuna kutozwa tena kiotomatiki bila ombi unaloidhinisha kwenye simu yako.',
          'Bei zimewekwa kwa dola za Marekani na kutozwa kwa sarafu yako kwa kiwango kinachoonyeshwa unapolipa.',
          'Malipo ndani ya programu ya simu hayapatikani. Simamia kifurushi chako kwenye tovuti, au tuulize kupitia Pata msaada.',
        ],
      },

      { h: 'Ukiacha kulipa' },
      {
        p: 'Kifurushi kikiisha, biashara zilizo ndani ya akaunti zinasimamishwa: huwezi kurekodi wala kufunga siku hadi ulipe. Takwimu zako hazifutwi. Lipa na kila kitu kinarudi kama kilivyokuwa. Kama akaunti ikakaa imesimamishwa kwa muda mrefu tutakuandikia kabla ya kufanya lolote zaidi, na hatutafuta vitabu vyako bila kukuambia kwanza.',
      },

      { h: 'Usichoruhusiwa kufanya' },
      {
        list: [
          'Usitumie huduma kurekodi au kuwezesha jambo lolote haramu.',
          'Usijaribu kufikia takwimu za mteja mwingine, kuchunguza mfumo, au kuzunguka mipaka ya kifurushi chako.',
          'Usiuze tena wala kubadilisha jina la huduma kuwa lako bila makubaliano ya maandishi nasi.',
          'Usipakie kitu ambacho si chako kupakia.',
        ],
      },

      { h: 'Tunachokudai' },
      {
        p: 'Tutaendesha huduma kwa uangalifu na ujuzi unaostahili, kuhifadhi takwimu zako pale tulipoahidi, na kukuambia jambo linapoharibika. Hatuahidi huduma haitawahi kukosekana. Pesa za simu zinasimama; mitandao inasimama; na sisi pia mara chache.',
      },

      { h: 'Tusichoahidi' },
      {
        p: 'Huduma inatolewa kama ilivyo. Inarekodi takwimu unazoweka na kufanya hesabu juu yake — haithibitishi kuwa ulichohesabu ndicho kilicho kwenye rafu, na si ushauri wa uhasibu, kodi wala sheria. Takwimu inazotoa ni nzuri kadri ya zilizoingizwa. Angalia vitabu vyako mwenyewe kabla ya kuzitegemea kwa jambo la maana.',
      },

      { h: 'Dhima' },
      {
        p: 'Kwa kadri sheria inavyoruhusu, dhima yetu yote kwako kwa madai yoyote ni kiasi ulicholipa katika miezi kumi na miwili kabla ya madai. Hatuna dhima kwa faida iliyopotea, biashara iliyopotea au takwimu zilizopotea zaidi ya hapo. Hakuna hapa kinachopunguza dhima ya udanganyifu au jambo lisiloweza kupunguzwa kisheria.',
      },

      { h: 'Kumaliza' },
      {
        p: 'Unaweza kufunga akaunti yako wakati wowote, kupitia Simamia → Futa akaunti yangu. Inaanza kufanya kazi papo hapo na ni ya kudumu. Tunaweza kusimamisha au kufunga akaunti inayovunja masharti haya, na tutasema kwa nini. Kama tutawahi kusitisha huduma, tutakupa angalau siku 60 na njia ya kuchukua takwimu zako.',
      },

      { h: 'Sheria' },
      { p: `Masharti haya yanasimamiwa na sheria ya ${COMPANY.jurisdiction}.` },

      { h: 'Mawasiliano' },
      { p: `${COMPANY.supportEmail}, au Pata msaada ndani ya programu.` },
    ],
  },
};

const DELETE_DOC: Record<Lang, Doc> = {
  en: {
    title: 'Delete your account',
    lede: `How to remove your ${COMPANY.product} account and everything in it.`,
    blocks: [
      { h: 'From inside the app' },
      {
        p: 'Open Manage, scroll to the bottom, and choose Delete my account. You will be asked to type the word DELETE to confirm. It happens straight away.',
      },

      { h: 'By email' },
      {
        p: `Write to ${COMPANY.supportEmail} from the address your account uses, asking for it to be deleted. We act within 30 days and will confirm when it is done. We will only act on a request from the account’s own email address — otherwise anyone could delete anyone.`,
      },

      { h: 'What is destroyed' },
      { p: 'All of it, permanently, with no recycle bin and no way back:' },
      {
        list: [
          'Your login and profile',
          'Every business in the account',
          'Every product, price and stock level',
          'Every closing, counted or verified, and every stock session',
          'Every ledger entry — sales, expenses, purchases, losses, staff debts',
          'Every staff record you added',
          'Every support thread and message',
          'The action history behind all of it',
        ],
      },

      { h: 'What is kept, and why' },
      {
        p: 'Payment records — the date, amount and reference of subscription charges. These are accounting records of a transaction between two businesses and we are required to keep them. They no longer connect to a person once the account is gone.',
      },

      { h: 'Before you do it' },
      {
        p: 'Export anything you want to keep first. Reports → Download PDF gives you the period summaries, and Stock → Export CSV gives you the product list with prices. Once the account is deleted we cannot recover any of it — not on request, not from a backup, not for a fee.',
      },

      { h: 'Questions' },
      { p: `${COMPANY.supportEmail}` },
    ],
  },
  sw: {
    title: 'Futa akaunti yako',
    lede: `Jinsi ya kuondoa akaunti yako ya ${COMPANY.product} na kila kilichomo.`,
    blocks: [
      { h: 'Kutoka ndani ya programu' },
      {
        p: 'Fungua Simamia, teremka hadi chini, chagua Futa akaunti yangu. Utaombwa kuandika neno DELETE kuthibitisha. Inatokea papo hapo.',
      },

      { h: 'Kwa barua pepe' },
      {
        p: `Andika ${COMPANY.supportEmail} kutoka anwani inayotumiwa na akaunti yako, ukiomba ifutwe. Tunatekeleza ndani ya siku 30 na tutathibitisha ikikamilika. Tutatekeleza ombi kutoka anwani ya akaunti yenyewe tu — vinginevyo yeyote angeweza kufuta akaunti ya yeyote.`,
      },

      { h: 'Kinachoharibiwa' },
      { p: 'Vyote, kabisa, bila pipa la kurudisha na bila njia ya kurudi:' },
      {
        list: [
          'Kuingia kwako na wasifu wako',
          'Kila biashara ndani ya akaunti',
          'Kila bidhaa, bei na kiwango cha hifadhi',
          'Kila kufunga, kulikohesabiwa au kuthibitishwa, na kila kipindi cha hesabu',
          'Kila ingizo la leja — mauzo, matumizi, manunuzi, hasara, madeni ya wafanyakazi',
          'Kila kumbukumbu ya mfanyakazi uliyemwongeza',
          'Kila mazungumzo na ujumbe wa msaada',
          'Historia ya vitendo nyuma ya yote hayo',
        ],
      },

      { h: 'Kinachobaki, na kwa nini' },
      {
        p: 'Kumbukumbu za malipo — tarehe, kiasi na rejea ya malipo ya kifurushi. Hizi ni kumbukumbu za hesabu za muamala kati ya biashara mbili na tunatakiwa kuzihifadhi. Haziunganishwi tena na mtu akaunti ikiisha kuondoka.',
      },

      { h: 'Kabla hujafanya' },
      {
        p: 'Pakua chochote unachotaka kubaki nacho kwanza. Ripoti → Pakua PDF inakupa muhtasari wa vipindi, na Bidhaa → Pakua CSV inakupa orodha ya bidhaa na bei. Akaunti ikishafutwa hatuwezi kurudisha chochote — si kwa ombi, si kutoka nakala rudufu, si kwa malipo.',
      },

      { h: 'Maswali' },
      { p: `${COMPANY.supportEmail}` },
    ],
  },
};

const DOCS: Record<string, Record<Lang, Doc>> = {
  privacy: PRIVACY,
  terms: TERMS,
  'delete-account': DELETE_DOC,
};

export function Legal() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const slug = pathname.replace(/^\/legal\/?/, '').replace(/\/$/, '') || 'privacy';

  // A reviewer may arrive with the phone set to either language. Default to
  // what the browser says, then let them switch.
  const [lang, setLang] = useState<Lang>(() =>
    (typeof navigator !== 'undefined' && navigator.language || '').toLowerCase().startsWith('sw') ? 'sw' : 'en',
  );

  const set = DOCS[slug] ?? PRIVACY;
  const doc = set[lang];

  const tabs: { slug: string; label: Record<Lang, string> }[] = [
    { slug: 'privacy', label: { en: 'Privacy', sw: 'Faragha' } },
    { slug: 'terms', label: { en: 'Terms', sw: 'Masharti' } },
    { slug: 'delete-account', label: { en: 'Delete account', sw: 'Futa akaunti' } },
  ];

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px 72px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 22 }}>
          <div className="tap" onClick={() => nav('/')} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/icons/bermi-mark.svg" alt="" width={34} height={34} style={{ borderRadius: 10 }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>{COMPANY.product}</div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>{COMPANY.name}</div>
            </div>
          </div>
          <button className="chip tap" onClick={() => setLang(lang === 'en' ? 'sw' : 'en')}>
            <Icon name="globe" size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />
            {lang === 'en' ? 'Kiswahili' : 'English'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
          {tabs.map((t) => (
            <button
              key={t.slug}
              className="chip tap"
              onClick={() => nav(`/legal/${t.slug}`)}
              style={
                t.slug === slug
                  ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }
                  : undefined
              }
            >
              {t.label[lang]}
            </button>
          ))}
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.7, margin: '0 0 8px' }}>{doc.title}</h1>
        <p style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--ink2)', fontWeight: 500, lineHeight: 1.55 }}>{doc.lede}</p>
        <p style={{ margin: '0 0 26px', fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>
          {lang === 'en' ? 'Last updated' : 'Ilisasishwa'} {LEGAL_UPDATED}
        </p>

        <div className="card" style={{ padding: '4px 20px 22px' }}>
          {doc.blocks.map((b, i) =>
            'h' in b ? (
              <h2 key={i} style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: -0.2, margin: '26px 0 10px' }}>
                {b.h}
              </h2>
            ) : 'p' in b ? (
              <p key={i} style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.7, color: 'var(--ink2)' }}>
                {b.p}
              </p>
            ) : (
              <ul key={i} style={{ margin: '0 0 12px', paddingLeft: 0, listStyle: 'none' }}>
                {b.list.map((li, j) => (
                  <li key={j} style={{ display: 'flex', gap: 10, margin: '0 0 9px', fontSize: 14, lineHeight: 1.65, color: 'var(--ink2)' }}>
                    <span style={{ flexShrink: 0, width: 5, height: 5, borderRadius: 3, background: 'var(--brand)', marginTop: 8 }} />
                    <span>{li}</span>
                  </li>
                ))}
              </ul>
            ),
          )}
        </div>

        <div style={{ marginTop: 22, fontSize: 12, color: 'var(--ink3)', fontWeight: 600, textAlign: 'center' }}>
          {COMPANY.name} · {COMPANY.supportEmail}
        </div>
      </div>
    </div>
  );
}
