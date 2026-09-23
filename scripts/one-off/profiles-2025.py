NI = "needs_information"
PE = "potentially_eligible"
NM = "not_matched"
NEW_FISH = ["FISH-10", "FISH-11", "FISH-12", "FISH-13", "FISH-14", "FISH-15", "FISH-16", "FISH-17"]


def exp(**kw):
    return "; ".join(f"{k.replace('_', '-')}={v}" for k, v in kw.items())


def with_new(base, status=NI, skip=()):
    extra = "; ".join(f"{s}={status}" for s in NEW_FISH if s not in skip)
    return base + "; " + extra if extra else base


def add_note(pid, text):
    r = find(PF, profile_id=pid)[0]
    old = get(PF, r, "notes") or ""
    if text not in old:
        setv(PF, r, "notes", (old + " " + text).strip())


prof("P-01", expected=with_new("FISH-01=potentially_eligible; FISH-02=potentially_eligible; FISH-03=potentially_eligible; FISH-04=potentially_eligible"))
add_note("P-01", "[2025 update] The new KFWFB schemes (widow pension, marriage, death, disability, SSLC award, treatment) need facts this household did not give, so they need information. FISH-06 is not matched at age 42.")

prof("P-03", expected="FISH-02=needs_information; FISH-01=needs_information; FISH-03=needs_information; FISH-04=needs_information; FISH-06=needs_information; FISH-08=needs_information; FISH-09=needs_information; " + "; ".join(f"{s}=needs_information" for s in NEW_FISH))
add_note("P-03", "[2025 update] Membership, age and the new KFWFB facts are unknown, so every fishing scheme needs information.")

prof("P-04", expected=with_new("FISH-01=needs_information; FISH-02=potentially_eligible; FISH-03=not_matched; FISH-04=potentially_eligible; FISH-06=needs_information; FISH-08=potentially_eligible; FISH-09=potentially_eligible"))
add_note("P-04", "[2025 update] FISH-01 now requires Welfare Fund Board membership (2025 guideline p.11), which this profile does not state, so it needs information. FISH-06 is now verified and needs membership, age, 10 years of work, retirement and 5 years of membership.")

prof("P-08", expected=with_new("FISH-01=needs_information; FISH-02=potentially_eligible; FISH-03=potentially_eligible; FISH-06=needs_information; PLNT-01=potentially_eligible; PLNT-04=potentially_eligible", skip=("FISH-17",)) + "; FISH-17=not_matched")
add_note("P-08", "[2025 update] FISH-01 needs Board membership, not given. FISH-17 is not matched because the member is 61 and the treatment scheme is for ages 23 to 60.")

prof("P-09", expected=with_new("FISH-08=not_matched; FISH-09=not_matched; FISH-01=needs_information; FISH-02=potentially_eligible; FISH-04=potentially_eligible; FISH-06=needs_information"))
add_note("P-09", "[2025 update] FISH-01 needs Board membership, not given.")

FULL_MEMBER = "livelihood=fishing; kfwfb_member=yes; kfwfb_contributions_paid=yes"

prof("P-11", title="Retired KFWFB member at the pension boundary (age 60, 5 years)", kind="boundary",
     answers=FULL_MEMBER + "; age=60; fisher_work_10_years=yes; retired_from_fishing=yes; kfwfb_membership_years=5",
     expected="FISH-06=potentially_eligible; FISH-01=potentially_eligible",
     expected_others="", expected_missing="FISH-17:family_event",
     written_by="AI-review",
     notes="2025 KFWFB guideline p.23: pension from 60 years, after 10 years as a fisherman, on retirement, with 5 years of membership. Age 60 and 5 years sit exactly on the limits.")

prof("P-12", title="Retired KFWFB member aged 59", kind="boundary",
     answers=FULL_MEMBER + "; age=59; fisher_work_10_years=yes; retired_from_fishing=yes; kfwfb_membership_years=12",
     expected="FISH-06=not_matched; FISH-01=potentially_eligible",
     expected_others="", expected_missing="",
     written_by="AI-review",
     notes="One year below the pension age. The app should show FISH-06 as not matched with age as the reason.")

prof("P-13", title="Member under 60 with a daughter's marriage, income just under the limit", kind="boundary",
     answers=FULL_MEMBER + "; kfwfb_family_status=member_under_60; family_event=daughter_marriage; bride_18=yes; annual_family_income=49999; kfwfb_membership_years=3",
     expected="FISH-11=potentially_eligible; FISH-01=potentially_eligible",
     expected_others="", expected_missing="",
     written_by="AI-review",
     notes="2025 KFWFB guideline p.15-16: income below Rs 50,000, 3 years from the first contribution, bride aged 18, application within 60 days. A member under 60 has no one-time limit, so prior assistance is not asked.")

prof("P-14", title="Marriage assistance at income exactly Rs 50,000", kind="boundary",
     answers=FULL_MEMBER + "; kfwfb_family_status=member_under_60; family_event=daughter_marriage; bride_18=yes; annual_family_income=50000; kfwfb_membership_years=3",
     expected="FISH-11=not_matched",
     expected_others="", expected_missing="",
     written_by="AI-review",
     notes="The page says income must be below (താഴെ) Rs 50,000, so exactly 50,000 is not matched.")

prof("P-15", title="Pensioner who already received marriage assistance once", kind="standard",
     answers="livelihood=fishing; kfwfb_family_status=pensioner; prior_marriage_assistance=yes; family_event=daughter_marriage; bride_18=yes; annual_family_income=30000; kfwfb_contributions_paid=yes; kfwfb_membership_years=10",
     expected="FISH-11=not_matched",
     expected_others="", expected_missing="",
     written_by="AI-review",
     notes="Items 3-5 on p.15 (over 60, pensioners, widows of pensioners) get the assistance for one daughter only if never received before.")

prof("P-16", title="Fisher's widow, not remarried, applying within 90 days", kind="standard",
     answers="livelihood=fishing; kfwfb_family_status=widow_of_fisher; regular_income_job=no; widow_remarried=no; death_within_3_months=yes",
     expected="FISH-10=potentially_eligible",
     expected_others="", expected_missing="FISH-13:family_event",
     written_by="AI-review",
     notes="2025 KFWFB guideline p.30-31.")

prof("P-17", title="Fisher's widow who has remarried", kind="standard",
     answers="livelihood=fishing; kfwfb_family_status=widow_of_fisher; regular_income_job=no; widow_remarried=yes; death_within_3_months=yes",
     expected="FISH-10=not_matched",
     expected_others="", expected_missing="",
     written_by="AI-review",
     notes="p.30, condition 2: the pension is cancelled from the month of remarriage.")

prof("P-18", title="Member under 60 died suddenly, not by accident", kind="standard",
     answers="livelihood=fishing; family_event=member_death; death_by_accident=no; deceased_under_60=yes; kfwfb_contributions_paid=yes; death_within_3_months=yes",
     expected="FISH-12=potentially_eligible; FISH-13=potentially_eligible",
     expected_others="", expected_missing="",
     written_by="AI-review",
     notes="2025 KFWFB guideline p.13 (Rs 1 lakh) and p.21 (Rs 15,000; amounts paid under another death scheme are deducted).")

prof("P-19", title="Member died after 60 and had stopped working", kind="standard",
     answers="livelihood=fishing; family_event=member_death; death_by_accident=no; deceased_under_60=no; deceased_active_after_60=no; kfwfb_contributions_paid=yes; death_within_3_months=yes",
     expected="FISH-12=not_matched; FISH-13=not_matched",
     expected_others="", expected_missing="",
     written_by="AI-review",
     notes="Both schemes cover a death under 60, or after 60 only if the member kept working, stayed on the list and kept paying.")

prof("P-20", title="Seriously ill member aged 23 with income at the limit", kind="boundary",
     answers=FULL_MEMBER + "; family_event=serious_illness; age=23; kfwfb_membership_years=5; annual_family_income=50000",
     expected="FISH-17=potentially_eligible; FISH-06=not_matched",
     expected_others="", expected_missing="",
     written_by="AI-review",
     notes="2025 KFWFB guideline p.25-26: ages 23 to 60, income not above Rs 50,000, 5 years of membership. Age 23 and income 50,000 are on the limits. Whether 23 and 60 are inclusive is flagged for second review.")

prof("P-21", title="Active member's child scored 8 A+ in SSLC", kind="standard",
     answers="livelihood=fishing; active_fisher=yes; kfwfb_member=yes; family_event=sslc_8_aplus",
     expected="FISH-16=potentially_eligible; FISH-01=potentially_eligible; FISH-03=needs_information",
     expected_others="", expected_missing="FISH-03:bpl",
     written_by="AI-review",
     notes="2025 KFWFB guideline SSLC award. The technical-school category is not modelled.")

prof("P-22", title="Member with a daughter's marriage, income not given", kind="incomplete",
     answers=FULL_MEMBER + "; kfwfb_family_status=member_under_60; family_event=daughter_marriage; bride_18=yes; annual_family_income=unknown; kfwfb_membership_years=4",
     expected="FISH-11=needs_information",
     expected_others="", expected_missing="FISH-11:annual_family_income",
     written_by="AI-review",
     notes="Every other marriage condition is met; only income is unknown, so the app must ask rather than guess.")
