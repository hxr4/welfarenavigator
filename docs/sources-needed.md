# Official sources still needed

Updated after the manually collected documents in `sources/` were read page by page (legacy-font Malayalam pages were read from the rendered images).

## Resolved by the collected documents

| Document | Saved as | Used for |
|---|---|---|
| Scheme approved 2025 KFWFB (welfare scheme guideline) | sources/kfwfb-welfare-schemes-guideline-2025.pdf | FISH-01 upgraded, FISH-06 upgraded to verified, FISH-10 to FISH-17 and FISH-21, FISH-22 added; FISH-19, FISH-20 display only |
| Kerala Small Plantation Workers' Welfare Fund Act, 2008 (Act 17 of 2008) | sources/kerala-small-plantation-workers-welfare-fund-act-2008.pdf | Act number corrected to 17; plantation_member help text; PLNT-07 |
| Small Plantation Workers' Welfare Fund Board office list with jurisdiction | sources/spwwfb-offices-jurisdiction.pdf | CEO office and 11 district executive offices, mapped by jurisdiction |
| Scheme 2009 Forms 14, 18, 20 | sources/spwwfb-form-14/18/20-*.pdf | Application form documents for PLNT-01, PLNT-04, PLNT-06 |
| G.O.(P) No.81/2024/LBR, 23 November 2024 | sources/gazette-go-p-81-2024-lbr-maternity-aadhaar.pdf | PLNT-05 board inclusion and Aadhaar or enrolment document |
| Saving cum Relief application and card | sources/fisheries-saving-cum-relief-*.pdf | FISH-02 contribution receipt document |
| Calamity equipment-loss application | sources/fisheries-calamity-equipment-loss-application.pdf | FISH-18 (display only) |
| Fisheries district officers | sources/fisheries-district-officers.pdf | Phones for all 14 districts |
| Small Plantation Workers' Board benefit pages (superannuation, family, invalid pension, marriage, maternity, death, medical, education, forms) | sources/plantationworker-benefit-pages-2026-09-23.txt (verbatim snapshot) | PLNT-01, 02, 04, 06, 07 upgraded; PLNT-08 and PLNT-09 added; PLNT-05 conflict noted |
| Labour Commissionerate Major Functions page and Indian Labour Year Book 2016 (p.6) | URLs in the sources sheet | PLNT-10 Estate Workers Distress Relief (display only) |
| Matsyafed contacts | sources/matsyafed-contacts.pdf | 10 district offices |

## Still needed

| # | Document | Authority | What it unblocks |
|---|---|---|---|
| 1 | The AIIS manual page that names the Small Plantation Workers' Board, or the portal's scheme-application board list | Labour Commissionerate | The Akshaya/AIIS route for PLNT schemes. The two portal manuals do not name the Board, and the public registration list (checked 2026-09-23) shows 8 boards without it, so the route stays marked unconfirmed. |
| 2 | Forms 15, 16, 17 and 19 and the education scholarship form | Small Plantation Workers' Board (forms page) | Where to submit for PLNT-02, PLNT-07, PLNT-09 and PLNT-08. Forms 14, 18 and 20 show the District Executive Officer in their office section; the others are not in hand. |
| 3 | Scheme 2009 text, or a Board page, for permanent-disability assistance | Small Plantation Workers' Board | PLNT-03 documents and procedure. The Board site has no page for it. |
| 4 | Educational benefit amount and course list | Small Plantation Workers' Board | PLNT-08 documents and amount. |
| 5 | Maternity benefit scheme guidelines referred to in G.O.(P) No.81/2024/LBR | Labour and Skills Department | PLNT-05 amount, deliveries and membership period under the current Labour Commissionerate scheme. The Board page figures are older and its membership sentence is incomplete. |
| 6 | Estate Workers (Distress Relief) Welfare Fund Scheme, 2007 notification | Labour Commissionerate | PLNT-10 eligibility. Display only until then. |
| 7 | The order that governs compensation for fishing equipment lost to calamities | Fisheries Department | FISH-18 eligibility. |
| 8 | Document lists for FISH-03, FISH-04, FISH-05, FISH-08, FISH-09 | Fisheries Department, Matsyafed | These schemes are screened, but the app says their document list is not published. |
| 9 | Matsyafed offices for Pathanamthitta, Idukki, Palakkad and Wayanad | Matsyafed | The app shows the two nearest offices in other districts and says so. |
| 10 | Correct Wayanad Fisheries landline and Palakkad Fisheries email | Fisheries Department | The printed values are malformed and are not used. |
| 11 | Matsyaboard Regional / Junior Executive office list | Kerala Fishermen's Welfare Fund Board | FISH-22 and FISH-16 applications go to these offices; the app points to the Fisheries office to ask for the address. |
| 12 | Full Akshaya centre list | Kerala State IT Mission | Individual centres beyond the 14 district project offices. |

## Conflicts found and how they are handled

| Scheme | Older source | Newer source | Used |
|---|---|---|---|
| FISH-01 group accident insurance | Fisheries Department page: "Active Fishermen", Rs 1 lakh | 2025 KFWFB guideline p.11: every Board member, Rs 10 lakh | 2025 guideline, conflict noted in the scheme notes |
| FISH-06 old-age pension | Department page: Rs 450 a month, registered fishermen and widows | 2025 KFWFB guideline p.18 to 19: Rs 1,600, age 60, 10 years of work, retired, 5 years of membership | 2025 guideline |
| FISH-17 treatment assistance | — | p.25 says "between 23 and 60" | Encoded inclusive (23 and 60 allowed); flagged for second review |
| PLNT-05 maternity | Board page: Rs 15,000 for two deliveries, Form 17, membership "at least year" | G.O.(P) No.81/2024/LBR: Labour Commissionerate web-based scheme, conditions in "extant guidelines" | Gazette route; Board figures kept in notes only |
| PLNT-04 marriage | Act s.3(5)(d): marriage of daughters | Board page: female members and members' daughters, Rs 3,000, 3 years | Board page (it adds the member's own marriage) |
