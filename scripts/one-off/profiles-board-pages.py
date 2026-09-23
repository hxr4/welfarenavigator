def prof(pid, **kw):
    rows = find(PF, profile_id=pid)
    d = dict(profile_id=pid, **kw)
    if rows:
        for k, v in d.items():
            setv(PF, rows[0], k, v)
    else:
        append(PF, d)


def add_answers(pid, extra):
    r = find(PF, profile_id=pid)[0]
    a = get(PF, r, "answers") or ""
    keys = {x.split("=")[0].strip() for x in a.split(";") if "=" in x}
    parts = [x for x in extra.split("; ") if x.split("=")[0] not in keys]
    if parts:
        setv(PF, r, "answers", a + "; " + "; ".join(parts))


def add_expected(pid, extra):
    r = find(PF, profile_id=pid)[0]
    e = get(PF, r, "expected") or ""
    have = {x.split("=")[0].strip(): x for x in e.split(";") if "=" in x}
    for x in extra.split("; "):
        have[x.split("=")[0].strip()] = x.strip()
    setv(PF, r, "expected", "; ".join(v.strip() for v in have.values()))


def add_note(pid, text):
    r = find(PF, profile_id=pid)[0]
    old = get(PF, r, "notes") or ""
    if text not in old:
        setv(PF, r, "notes", (old + " " + text).strip())


NEW_F = "FISH-21=needs_information; FISH-22=needs_information"
for pid in ["P-01", "P-03", "P-04", "P-09"]:
    add_expected(pid, NEW_F)
    add_note(pid, "[board pages] Maternity care (FISH-21) and the +2 award (FISH-22) need the family-events answer, which this household did not give.")

add_answers("P-05", "plantation_membership_years=5; plantation_member_death=no; plantation_medical_treatment=no; plantation_child_class10=no")
add_expected("P-05", "PLNT-01=potentially_eligible; PLNT-06=not_matched; PLNT-07=not_matched; PLNT-08=not_matched; PLNT-09=not_matched")
add_note("P-05", "[board pages] Superannuation now needs 5 years of continuous membership (Board page); 5 years sits on the limit.")

PL_NI = "PLNT-06=needs_information; PLNT-07=needs_information; PLNT-08=needs_information; PLNT-09=needs_information"
for pid in ["P-06", "P-07"]:
    add_expected(pid, PL_NI)
    add_note(pid, "[board pages] Death assistance, family pension, education and medical benefit need facts this household did not give.")

add_answers("P-08", "plantation_membership_years=6")
add_expected("P-08", "PLNT-01=potentially_eligible; PLNT-04=potentially_eligible; " + PL_NI + "; " + NEW_F)
add_note("P-08", "[board pages] 6 years of membership meets the 5-year pension and 3-year marriage rules.")

add_expected("P-10", "PLNT-06=needs_information; PLNT-07=needs_information")
add_note("P-10", "[board pages] Death assistance and family pension depend on whether a member in the family has died, not on the applicant's own membership, so they need information.")

PM = "livelihood=plantation_worker; plantation_member=yes"
new = [
    ("P-23", "Plantation member, 3 years, daughter's marriage", "boundary", PM + "; plantation_membership_years=3; daughter_marriage=yes",
     "PLNT-04=potentially_eligible", "", "Board Marriage Assistance page: at least 3 years of membership; 3 sits on the limit."),
    ("P-24", "Plantation member, 2 years, daughter's marriage", "boundary", PM + "; plantation_membership_years=2; daughter_marriage=yes",
     "PLNT-04=not_matched", "", "One year short of the 3-year membership rule; one step away."),
    ("P-25", "Plantation member aged 60 with 4 years of membership", "boundary", PM + "; age=60; plantation_membership_years=4",
     "PLNT-01=not_matched", "", "Superannuation needs 5 years of continuous membership."),
    ("P-26", "Family of a plantation member who died after 15 years of work", "standard",
     "livelihood=plantation_worker; plantation_member_death=yes; plantation_deceased_contrib_3y=yes; plantation_deceased_worked_15y=yes",
     "PLNT-06=potentially_eligible; PLNT-07=potentially_eligible", "", "Board Death Assistance (Rs 10,000) and Family Pension (50% of pension) pages."),
    ("P-27", "Family of a plantation member who died after 10 years of work", "standard",
     "livelihood=plantation_worker; plantation_member_death=yes; plantation_deceased_contrib_3y=yes; plantation_deceased_worked_15y=no",
     "PLNT-06=potentially_eligible; PLNT-07=not_matched", "", "Family pension needs 15 years of work in a small plantation; death assistance has no published duration rule."),
    ("P-28", "Plantation member, 3 years, family member treated in hospital", "boundary", PM + "; plantation_membership_years=3; plantation_medical_treatment=yes",
     "PLNT-09=potentially_eligible; PLNT-08=needs_information", "PLNT-08:plantation_child_class10", "Board Medical Benefit page: 3 years of membership, worker and family members."),
    ("P-29", "Plantation member unable to work, but for less than two years", "standard", PM + "; unable_due_infirmity=yes; incapacitated_over_2_years=no",
     "PLNT-02=not_matched", "", "Board Invalid Pension page requires incapacity beyond two years."),
    ("P-30", "Fisher family expecting a baby, member with no arrears, mother 19+", "standard",
     "livelihood=fishing; family_event=delivery; kfwfb_member=yes; kfwfb_contributions_paid=yes; mother_age_19=yes",
     "FISH-21=potentially_eligible; FISH-16=not_matched; FISH-22=not_matched", "", "2025 KFWFB guideline p.28."),
    ("P-31", "Fisher family expecting a baby, mother under 19", "standard",
     "livelihood=fishing; family_event=delivery; kfwfb_member=yes; kfwfb_contributions_paid=yes; mother_age_19=no",
     "FISH-21=not_matched", "", "p.28: the woman must be at least 19."),
    ("P-32", "Active member's child with A+ in all +2 subjects", "standard",
     "livelihood=fishing; family_event=plus_two_all_aplus; kfwfb_member=yes; kfwfb_contributions_paid=yes",
     "FISH-22=potentially_eligible; FISH-16=not_matched; FISH-21=not_matched", "", "2025 KFWFB guideline p.29."),
]
for pid, title, kind, answers, expected, missing, notes in new:
    prof(pid, title=title, kind=kind, answers=answers, expected=expected, expected_others="", expected_missing=missing, written_by="AI-review", notes=notes)
