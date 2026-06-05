/**
 * SDLT on residential tenancies — content for relocation professionals.
 * Last reviewed: 2026-06-03.
 *
 * Inline citations: [cite:N] in detail[] paragraphs references index N in
 * that scenario's sources[] array. The renderer replaces them with source chips.
 */
window.SDLT_POLICY_TRACKER_DATA = {

  meta: {
    lastVerified: '2026-06-03',
    title: 'SDLT on residential tenancies',
    subtitle: 'An update for relocation professionals — what the Renters\' Rights Act and April 2026 Treasury announcement mean for your clients\' leases'
  },

  disclaimer:
    'This briefing is for general information only and does not constitute tax or legal advice. Legislation confirming the assured-tenancy exemption is expected in Finance Bill 2026–27. Please contact us for advice on a specific lease.',

  intro:
    'SDLT on residential leases has not gone away — it has simply changed shape. Whether stamp duty applies, and how much, turns entirely on who is named as tenant. The position differs significantly depending on whether the lease is in an individual\'s name or a company\'s name. Below we set out each scenario and what it means in practice.',

  /**
   * scenarios[] is the primary content.
   * Each entry renders as a top-level advice card followed by expandable reasoning + sources.
   *
   * status: 'safe' | 'caution' | 'action'
   * advice[]: plain-English paragraphs shown by default (no citations needed here)
   * detail[]: full reasoning paragraphs, may contain [cite:N] tokens
   * example: optional compact table shown in the detail section
   * sources[]: referenced by [cite:N] in detail[]
   */
  scenarios: [
    {
      id: 'individual-assured',
      status: 'safe',
      statusLabel: 'No SDLT on rent',
      heading: 'Lease in the individual\'s name — rent at or below £100,000 per year',
      advice: [
        'Where the lease is in your client\'s own name and the annual rent is £100,000 or below, the tenancy will generally qualify as an assured periodic tenancy under the Housing Act 1988 as amended by the Renters\' Rights Act 2025. From 1 May 2026 the rent element of such tenancies is exempt from SDLT.',
        'This means no stamp duty return is required for the rent, and no SDLT is due — even if cumulative rent would otherwise have exceeded the £125,000 NPV threshold over time (which can happen around year three at £5,000 per month).',
        'No action is required on SDLT for the rent. If a premium was paid on the lease, or if you are unsure whether the arrangement qualifies, please contact us.'
      ],
      detail: [
        'The exemption was announced in a Written Ministerial Statement on 22 April 2026 (HCWS1535) and will be enacted in Finance Bill 2026–27 applying retrospectively from 1 May 2026. [cite:0][cite:1] HMRC will not collect SDLT on the rent element of qualifying assured tenancies in the interim.',
        'A tenancy qualifies as "assured" only if it falls within section 1 of the Housing Act 1988. [cite:0] The critical exclusions are: annual rent exceeding £100,000, company lets, certain student lets, lodger arrangements, and other statutory excluded categories listed in Schedule 1 to the Act.',
        'The two monetary thresholds serve entirely different purposes. £100,000 is the Housing Act cap that determines who qualifies for an assured tenancy and therefore who benefits from the exemption. £125,000 is the SDLT net present value threshold above which SDLT on rent is charged at 1% — relevant only for leases that remain chargeable. [cite:0] For an assured tenancy the NPV calculation is academic: the exemption means no SDLT is due regardless of NPV.'
      ],
      example: {
        label: 'Example — individual assured tenant at £5,000/month',
        rows: [
          { year: '1', npv: '~£60,000',   sdlt: '£0 — exempt' },
          { year: '2', npv: '~£117,971',  sdlt: '£0 — exempt' },
          { year: '3', npv: '~£173,982',  sdlt: '£0 — exempt (theoretical without exemption: ~£490)' },
          { year: '4', npv: '~£227,000+', sdlt: '£0 — exempt (theoretical without exemption: further top-ups)' }
        ]
      },
      sources: [
        { title: 'CIOT — RRA and SDLT on residential leases', url: 'https://www.tax.org.uk/renters-rights-act-2025-rra-and-sdlt-on-residential-leases' },
        { title: 'Forsters — tenant SDLT FAQ', url: 'https://www.forsters.co.uk/news-and-views/residential-sdlt-i-am-a-private-rental-tenant-do-i-have-to-pay-stamp-duty-land-tax' }
      ]
    },

    {
      id: 'individual-high-rent',
      status: 'caution',
      statusLabel: 'SDLT applies',
      heading: 'Lease in the individual\'s name — rent over £100,000 per year',
      advice: [
        'Annual rent above £100,000 means the tenancy cannot be an assured tenancy under the Housing Act 1988. The April 2026 exemption does not apply. SDLT on rent accrues under the growing-lease rules.',
        'Under those rules, the cumulative net present value of rent is recalculated at each anniversary. SDLT at 1% on NPV above £125,000 becomes payable — often from year two at higher rents. A return must be filed and payment made within 14 days of the anniversary trigger. Penalties for missing a return can exceed the SDLT itself.',
        'Please provide the lease and rent details as early as possible so we can calculate the NPV and ensure the filing deadline is met.'
      ],
      detail: [
        'The Renters\' Rights Act converts residential tenancies into rolling periodic tenancies rather than fixed terms. For leases outside the assured-tenancy regime this matters for SDLT: a periodic lease is treated as an indefinite-term lease initially deemed one year, growing by one year at each anniversary. [cite:0][cite:3] There is only one SDLT transaction and the NPV of rent accumulates over the deemed term.',
        'SDLT is charged at 1% on cumulative NPV above £125,000, calculated at a 3.5% discount rate set by HMRC. [cite:3] The tenant is required to recalculate at each anniversary and file a supplementary SDLT return within 14 days, paying any additional tax due at the same time.',
        'Rent increases after year 5 are ignored — the highest rent from years 1 to 5 is used for all subsequent years. [cite:3][cite:4] This can actually limit liability at very high rents if the increase occurs after year 5.',
        'A further 2% non-resident surcharge applies if the tenant fails the SDLT residence test at the effective date of the lease. This is a 183-day physical presence test — not the income-tax Statutory Residence Test — and citizenship or visa status does not determine it. [cite:1] If the tenant subsequently meets the forward-looking test (183 days in the year after the effective date), the surcharge can be reclaimed within two years.'
      ],
      example: {
        label: 'Example — individual, rent over £100,000 p.a.',
        rows: [
          { year: '1', npv: '~£115,942 (£120k rent)',  sdlt: 'Nil (under £125k NPV)' },
          { year: '2', npv: '~£227,963',               sdlt: '~£1,030 due' },
          { year: '3', npv: '~£363,251 (£150k rent)',  sdlt: '~£1,353 additional' },
          { year: '5', npv: '~£628,676 (£160k rent)',  sdlt: '~£1,347 additional' },
          { year: '6', npv: '~£758,834',               sdlt: '~£1,302 (uses £160k cap from yrs 1–5)' }
        ]
      },
      sources: [
        { title: 'GOV.UK — non-UK resident SDLT rates', url: 'https://www.gov.uk/guidance/rates-of-stamp-duty-land-tax-for-non-uk-residents' },
        { title: 'KPMG — new SDLT burden for private renters', url: 'https://kpmg.com/uk/en/insights/tax/tmd-new-sdlt-burden-for-private-renters.html' },
        { title: 'Wedlake Bell — compliance risk', url: 'https://wedlakebell.com/insights/sdlt-and-the-renters-rights-act-the-compliance-risk-few-tenants-expect/' },
        { title: 'GOV.UK — SDLT leasehold purchases', url: 'https://www.gov.uk/guidance/stamp-duty-land-tax-leasehold-purchases' },
        { title: 'GOV.UK — residential property rates', url: 'https://www.gov.uk/stamp-duty-land-tax/residential-property-rates' }
      ]
    },

    {
      id: 'company-tenant',
      status: 'action',
      statusLabel: 'SDLT applies — contact us',
      heading: 'Lease in a company or employer\'s name',
      advice: [
        'Only individuals can hold assured tenancies. A lease in a company\'s name — regardless of whether it is a UK-registered company, an overseas employer, or an SPV — can never be an assured tenancy. The April 2026 exemption does not apply.',
        'This is the most important point for employer-funded relocations: even a modest rent can generate SDLT liability over time. At £5,000 per month (£60,000 per year), the growing-lease rules typically produce an SDLT charge from around year three, with returns and payment due within 14 days.',
        'A UK-incorporated company is not automatically safe from the 2% non-resident surcharge. Where a UK Ltd is a close company controlled by non-UK resident participators (shareholders, trustees, or partners), the surcharge applies in addition to standard growing-lease SDLT — even though the company is UK-registered.',
        'Please send us the lease, the company structure (shareholders, any parent entities, trustees), and the effective dates so we can assess the full position.'
      ],
      detail: [
        'Section 1 of the Housing Act 1988 [cite:0] requires each tenant to be an individual who occupies the dwelling as their only or principal home. A body corporate cannot satisfy this condition. The assured status — and the SDLT exemption that flows from it — is not available to company tenants at any rent level.',
        'For a company let, SDLT on rent is calculated under the growing-lease regime. [cite:1] The deemed term grows by one year at each anniversary; SDLT at 1% applies to cumulative NPV above £125,000. At £60,000 per year this threshold is typically crossed around year three, at which point a return must be filed within 14 days.',
        'The 2% non-resident surcharge is assessed separately from the assured-tenancy exemption. [cite:2][cite:3] A corporate tenant is non-UK resident if it is not UK resident for Corporation Tax at the effective date. Additionally, a UK-resident company can still be caught if it is a close company whose control rests with non-UK resident participators under Schedule 9A FA 2003.',
        'The non-UK control test looks through to who ultimately controls the close company — following participator and attribution rules, not simply where the company is incorporated. [cite:3] A UK Ltd whose shares are held by a non-UK individual may therefore carry the 2% surcharge even though it is UK-registered and the lease is in England.',
        'Where the company is the tenant, SDLT on any lease premium also follows company residential rules (higher rates from £40,000; up to 17% above £500,000 unless relief applies). [cite:1] This is a separate analysis from the rent NPV position.'
      ],
      example: {
        label: 'Example — company tenant at £5,000/month (£60,000 p.a.)',
        rows: [
          { year: '1', npv: '~£60,000',   sdlt: 'Nil (under £125k NPV)' },
          { year: '2', npv: '~£117,971',  sdlt: 'Nil (still under £125k NPV)' },
          { year: '3', npv: '~£173,982',  sdlt: '~£490 (1% on NPV above £125k)' },
          { year: '8+', npv: 'Cumulative higher', sdlt: 'Possible additional 2% surcharge on rent NPV if non-UK control applies' }
        ]
      },
      sources: [
        { title: 'Housing Act 1988 — section 1', url: 'https://www.legislation.gov.uk/ukpga/1988/50/section/1' },
        { title: 'GOV.UK — SDLT corporate bodies', url: 'https://www.gov.uk/guidance/stamp-duty-land-tax-corporate-bodies' },
        { title: 'GOV.UK — non-UK resident SDLT rates', url: 'https://www.gov.uk/guidance/rates-of-stamp-duty-land-tax-for-non-uk-residents' },
        { title: 'HMRC SDLTM09915 — non-UK control test', url: 'https://www.gov.uk/hmrc-internal-manuals/stamp-duty-land-tax-manual/sdltm09915' }
      ]
    }
  ],

  keyDates: [
    {
      date: '2026-04-22',
      milestone: true,
      headline: 'HM Treasury written statement (HCWS1535)',
      summary: 'Government announces that assured periodic tenancies will not give rise to SDLT on the rent element. Finance Bill 2026–27 to legislate this from 1 May 2026; HMRC not collecting interim SDLT on qualifying assured rent.',
      url: 'https://questions-statements.parliament.uk/written-statements/detail/2026-04-22/hcws1535'
    },
    {
      date: '2026-05-01',
      milestone: true,
      headline: 'Renters\' Rights Act 2025 in force (England)',
      summary: 'Standard residential tenancies default to assured periodic tenancies. This changes how leases are characterised for SDLT — and brings the growing-lease rules into play for tenancies outside the assured regime.',
      url: 'https://www.legislation.gov.uk/ukpga/2025/19/contents'
    },
    {
      date: null,
      headline: 'Finance Bill 2026–27 (pending)',
      summary: 'Legislation to formally enact the assured-tenancy SDLT exemption is expected at or before the next Budget. Until enacted, rely on HMRC\'s interim practice. All other SDLT rules remain in full force now.'
    }
  ]

};
