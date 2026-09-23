FO = "fisheries_district_office"
HOW_KB_EN = "Ask at your Fisheries Department district office about joining the Kerala Fishermen's Welfare Fund Board."
HOW_KB_ML = "കേരള മത്സ്യത്തൊഴിലാളി ക്ഷേമനിധി ബോർഡിൽ അംഗമാകുന്നതിനെക്കുറിച്ച് ഫിഷറീസ് വകുപ്പ് ജില്ലാ ഓഫീസിൽ അന്വേഷിക്കുക."
KB = "Kerala Fishermen's Welfare Fund Board"
KB_ML = "കേരള മത്സ്യത്തൊഴിലാളി ക്ഷേമനിധി ബോർഡ്"

for v, en, ml in [
    ("delivery", "A woman in the family is expecting a baby or has just given birth", "കുടുംബത്തിലെ ഒരു സ്ത്രീ ഗർഭിണിയാണ്, അല്ലെങ്കിൽ അടുത്തിടെ പ്രസവിച്ചു"),
    ("plus_two_all_aplus", "A child got A+ in all subjects in the Higher Secondary (+2) or VHSE final exam, passing in the first attempt", "ഹയർ സെക്കന്ററി (+2) / വി.എച്ച്.എസ്.ഇ അവസാന വർഷ പരീക്ഷയിൽ ആദ്യ അവസരത്തിൽ തന്നെ കുട്ടിക്ക് എല്ലാ വിഷയങ്ങളിലും എ+ ലഭിച്ചു"),
]:
    delete_where(O, fact_id="family_event", value=v)
    none_rows = find(O, fact_id="family_event", value="none")
    if none_rows:
        O.insert_rows(none_rows[0])
        r = none_rows[0]
        for k, val in dict(fact_id="family_event", value=v, label_en=en, label_ml=ml).items():
            setv(O, r, k, val)
    else:
        append(O, dict(fact_id="family_event", value=v, label_en=en, label_ml=ml))

fact(fact_id="mother_age_19", type="boolean", label_en="Mother is at least 19", label_ml="അമ്മയ്ക്ക് 19 വയസ്സെങ്കിലും",
     question_en="Is the woman who is expecting or has given birth at least 19 years old?",
     question_ml="ഗർഭിണിയായ / പ്രസവിച്ച സ്ത്രീക്ക് 19 വയസ്സെങ്കിലും പ്രായമുണ്ടോ?", sensitivity="medium", ask_order=31)

for did, en, ml in [
    ("sterilisation_doctor_certificate", "Certificate from the approved government doctor who performed the surgery", "ശസ്ത്രക്രിയ നടത്തിയ അംഗീകൃത സർക്കാർ ഡോക്ടറുടെ സർട്ടിഫിക്കറ്റ്"),
    ("mbbs_medical_certificate", "Medical certificate from an MBBS-qualified doctor", "എം.ബി.ബി.എസ് യോഗ്യതയുള്ള ഡോക്ടറിൽ നിന്നുള്ള മെഡിക്കൽ സർട്ടിഫിക്കറ്റ്"),
    ("legal_age_proof", "Legally valid proof of age", "വയസ്സ് തെളിയിക്കുന്നതിനുള്ള നിയമാനുസൃത രേഖ"),
    ("final_mark_list", "True copy of the final-year exam mark list", "അവസാന വർഷ പരീക്ഷയുടെ മാർക്ക് ലിസ്റ്റിന്റെ ശരിപ്പകർപ്പ്"),
    ("sslc_book_age", "True copy of the SSLC book as proof of age", "വയസ്സ് തെളിയിക്കുന്ന എസ്.എസ്.എൽ.സി ബുക്കിന്റെ ശരി പകർപ്പ്"),
    ("parent_fisher_certificate", "True copy of a certificate that the parent is a fisherman", "രക്ഷിതാവ് മത്സ്യത്തൊഴിലാളിയാണെന്ന് തെളിയിക്കുന്ന സർട്ടിഫിക്കറ്റിന്റെ ശരി പകർപ്പ്"),
    ("contribution_no_arrears_certificate", "Certificate that contributions are paid with no arrears, and a photocopy of the passbook page", "വിഹിതം കുടിശ്ശികയില്ലാതെ അടച്ചതിന്റെ സർട്ടിഫിക്കറ്റും പാസ് ബുക്കിലെ ബന്ധപ്പെട്ട പേജിന്റെ ഫോട്ടോകോപ്പിയും"),
]:
    doc(did, en, ml, K)

scheme("FISH-19", name_en="Family Planning Assistance", name_ml="കുടുംബ സംവിധാന പദ്ധതി", authority_en=KB, authority_ml=KB_ML, category="fishing",
       summary_en="₹500 towards care expenses for a fisherwoman or fisherman who undergoes sterilisation surgery. Apply within 60 days of the surgery.",
       summary_ml="വന്ധ്യംകരണ ശസ്ത്രക്രിയക്ക് വിധേയരാകുന്ന മത്സ്യത്തൊഴിലാളികൾക്ക് ശുശ്രൂഷാ ചെലവിനായി 500 രൂപ. ശസ്ത്രക്രിയ കഴിഞ്ഞ് 60 ദിവസത്തിനകം അപേക്ഷിക്കണം.",
       eligibility_verification="informational", documents_verification="verified", apply_verification="verified",
       notes="2025 KFWFB guideline p.24 (scheme 9). Shown for information only, by design: screening it would mean asking about reproductive surgery, which the minimum-data rule avoids for a Rs 500 benefit.")
docs_for("FISH-19", [("sterilisation_doctor_certificate", K, "ശസ്ത്രക്രിയ നടത്തിയ അംഗീകൃത സർക്കാർ ഡോക്ടറുടെ സർട്ടിഫിക്കറ്റ്"),
                     ("kfwfb_passbook", K, "മത്സ്യബോർഡ് പാസ്സ് ബുക്കിന്റെ ശരി പകർപ്പ് ഫിഷറീസ് ഓഫീസർ സാക്ഷ്യപ്പെടുത്തിയത്.")])
apply_for("FISH-19", [dict(type_id=FO, mode="in_person", note_en="Submit 2 copies of the prescribed form to the Fisheries Officer within 60 days of the surgery.",
                           note_ml="ശസ്ത്രക്രിയ നടത്തിയ 60 ദിവസത്തിനകം നിശ്ചിത ഫോറത്തിൽ 2 പകർപ്പുകൾ ഫിഷറീസ് ഓഫീസർക്ക് സമർപ്പിക്കുക.", source_id=K,
                           quote="ശസ്ത്രക്രിയ നടത്തിയ 60 ദിവസത്തിനകം നിശ്ചിത ഫോറത്തിൽ അപേക്ഷയുടെ 2 പകർപ്പുകൾ തയ്യാറാക്കി ബന്ധപ്പെട്ട ഫിഷറീസ് ഓഫീസർക്ക് സമർപ്പിക്കേണ്ടതാണ്.")])

scheme("FISH-20", name_en="Chairman's Relief Fund", name_ml="ചെയർമാൻസ് റിലീഫ് ഫണ്ട്", authority_en=KB, authority_ml=KB_ML, category="fishing",
       summary_en="Emergency help of up to ₹5,000 for fishermen in sudden distress: serious accident injury, accidental death, fire or damage to the house, relief camps, snake or dog bite, electric shock, or a family member missing at sea. The amount depends on how serious the case is.",
       summary_ml="അപ്രതീക്ഷിത ദുരിതത്തിലാകുന്ന മത്സ്യത്തൊഴിലാളികൾക്ക് പരമാവധി 5,000 രൂപ വരെ അടിയന്തിര ധനസഹായം: അപകടത്തിൽ ഗുരുതര പരിക്ക്, അപകട മരണം, തീപിടുത്തം/വീടിന് നാശം, അഭയാർത്ഥി ക്യാമ്പ്, പാമ്പ്/പേനായ കടി, ഷോക്ക്, കടലിൽ കാണാതാകൽ.",
       eligibility_verification="informational", documents_verification="partial", apply_verification="verified",
       notes="2025 KFWFB guideline p.27 (scheme 11). Discretionary: the amount is set case by case and Board officials visit the site, so it is shown for information, not screened. No document list is published.")
docs_for("FISH-20", [])
apply_for("FISH-20", [dict(type_id=FO, mode="in_person", note_en="Tell the Fisheries Officer as soon as possible. Board officials visit and sanction the help; an application can also be given to the Fisheries Officer.",
                           note_ml="എത്രയും വേഗം ഫിഷറീസ് ഓഫീസറെ അറിയിക്കുക. മത്സ്യബോർഡ് ഉദ്യോഗസ്ഥർ സ്ഥലം സന്ദർശിച്ച് ധനസഹായം അനുവദിക്കും; ഫിഷറീസ് ഓഫീസർക്ക് അപേക്ഷയും നൽകാം.", source_id=K,
                           quote="ധനസഹായത്തുക അടിയന്തിര സന്ദർഭങ്ങളോടനുബന്ധിച്ച് അപേക്ഷ തയ്യാറാക്കി ഫിഷറീസ് ഓഫീസർക്ക് സമർപ്പിക്കാവുന്നതാണ്.")])

Q21 = "ക്ഷേമനിധിയിൽ കുടിശ്ശിക ഇല്ലാതെ വിഹിതം അടച്ചുതീർത്തിട്ടുള്ള പ്രവർത്തിസജീവ മത്സ്യത്തൊഴിലാളി വനിതകൾക്കും, മത്സ്യത്തൊഴിലാളികളുടെ ഭാര്യമാർക്കും പ്രസവ ശുശ്രൂഷാ ധനസഹായമായി 750/- രൂപ വീതം നൽകി വരുന്നു"
Q21B = "മത്സ്യത്തൊഴിലാളികളായ വനിതകൾക്ക് നേരിട്ട് ധനസഹായ അപേക്ഷ സമർപ്പിക്കാം. ഭർത്താവിന് ക്ഷേമനിധി അംഗത്വം ഉണ്ടായിരിക്കുകയും ഭാര്യക്ക് അംഗത്വമില്ലാതിരിക്കുകയും ചെയ്യുന്ന സന്ദർഭങ്ങളിൽ ഭർത്താവാണ് ധനസഹായ അപേക്ഷ സമർപ്പിക്കേണ്ടത്."
scheme("FISH-21", name_en="Maternity Care Assistance (Fishermen's Welfare Fund)", name_ml="പ്രസവ ശുശ്രൂഷക്കുള്ള ധനസഹായ പദ്ധതി", authority_en=KB, authority_ml=KB_ML, category="fishing",
       summary_en="₹750 for maternity care, for an active fisherwoman member with no contribution arrears, or the wife of a member. The woman must be at least 19.",
       summary_ml="കുടിശ്ശികയില്ലാതെ വിഹിതം അടച്ച പ്രവർത്തിസജീവ മത്സ്യത്തൊഴിലാളി വനിതകൾക്കും മത്സ്യത്തൊഴിലാളികളുടെ ഭാര്യമാർക്കും പ്രസവ ശുശ്രൂഷയ്ക്ക് 750 രൂപ. 19 വയസ്സെങ്കിലും വേണം.",
       eligibility_verification="verified", documents_verification="verified", apply_verification="verified",
       notes="2025 KFWFB guideline p.28 (scheme 12). The Board member may be the woman herself or her husband; if only the husband is a member, he applies. The application window ('2 to 8 weeks' of the delivery date) is shown in the apply note, not asked, because the page does not say whether it is before or after the delivery.")
cond("FISH-21", "g0", 0, "livelihood", "includes", "fishing", "മത്സ്യത്തൊഴിലാളി കുടുംബങ്ങളിലെ വനിതകളുടെ ക്ഷേമം ലക്ഷ്യമിട്ടുകൊണ്ടുള്ള ഒരു പദ്ധതിയാണിത്.", "p.28", K)
cond("FISH-21", "c1", 1, "family_event", "includes", "delivery", Q21, "p.28", K)
cond("FISH-21", "c2", 2, "kfwfb_member", "eq", "yes", Q21B, "p.28, conditions", K, changeable="yes", how_en=HOW_KB_EN, how_ml=HOW_KB_ML)
cond("FISH-21", "c3", 3, "kfwfb_contributions_paid", "eq", "yes", Q21, "p.28", K, changeable="yes",
     how_en="Clear any arrears of Welfare Fund contribution at the Fisheries Office.", how_ml="ക്ഷേമനിധി വിഹിതത്തിലെ കുടിശ്ശിക ഫിഷറീസ് ഓഫീസിൽ അടച്ചുതീർക്കുക.")
cond("FISH-21", "c4", 4, "mother_age_19", "eq", "yes", "പ്രസ്തുത വനിതയ്ക്ക് 19 വയസ്സെങ്കിലും പ്രായം ഉണ്ടായിരിക്കേണ്ടതാണ്.", "p.28, conditions", K)
docs_for("FISH-21", [("mbbs_medical_certificate", K, "എം.ബിബി എസ് യോഗ്യതയുള്ള ഡോക്ടറിൽ നിന്നും ലഭിച്ച മെഡിക്കൽ സർട്ടിഫിക്കററ്റ്"),
                     ("marriage_certificate", K, "അപേക്ഷയുടെ / അപേക്ഷകന്റെ വിവാഹ സർട്ടിഫിക്കറ്റ്"),
                     ("legal_age_proof", K, "വയസ്സ് തെളിയിക്കുന്നതിനുള്ള നിയമാനുസൃത രേഖ")])
apply_for("FISH-21", [dict(type_id=FO, mode="in_person", note_en="Submit 2 copies of the prescribed form with the documents to the Fisheries Officer, within 2 to 8 weeks of the delivery date.",
                           note_ml="നിർദ്ദിഷ്ട ഫോറത്തിൽ 2 പകർപ്പുകൾ രേഖകൾ സഹിതം പ്രസവ തിയ്യതിക്ക് 2 മുതൽ 8 ആഴ്ച്ചക്കുള്ളിലായി ഫിഷറീസ് ഓഫീസർക്ക് സമർപ്പിക്കുക.", source_id=K,
                           quote="നിർദ്ദിഷ്ട ഫോറത്തിൽ അപേക്ഷയുടെ 2 പകർപ്പുകൾ തയ്യാറാക്കി താഴെ കാണിച്ചിട്ടുള്ള രേഖകൾ സഹിതം പ്രസവ തിയ്യതിക്ക് 2 മുതൽ 8 ആഴ്ച്ചക്കുള്ളിലായി ഫിഷറീസ് ഓഫീസർക്ക് സമർപ്പിക്കേണ്ടതാണ്.")])

Q22M = "മത്സ്യബോർഡിൽ സജീവ അംഗത്വമുള്ളവരുടെ മക്കൾക്ക് മാത്രമെ ഈ പദ്ധതി പ്രകാരമുള്ള ധനസഹായത്തിന് അർഹതയുണ്ടായിരിക്കുകയുള്ളൂ."
scheme("FISH-22", name_en="Higher Education Incentive (+2 / VHSE Cash Award)", name_ml="ഉന്നത വിദ്യാഭ്യാസ പ്രോത്സാഹന പദ്ധതി", authority_en=KB, authority_ml=KB_ML, category="fishing",
       summary_en="₹5,000 cash award and a memento for children of active Board members who get A+ in all subjects in the Higher Secondary (+2) or VHSE exam, passing in the first attempt.",
       summary_ml="ഹയർ സെക്കന്ററി (+2) / വി.എച്ച്.എസ്.ഇ പരീക്ഷയിൽ ആദ്യ അവസരത്തിൽ എല്ലാ വിഷയങ്ങൾക്കും എ+ നേടുന്ന, മത്സ്യബോർഡിൽ സജീവ അംഗത്വമുള്ളവരുടെ മക്കൾക്ക് 5,000 രൂപ ക്യാഷ് അവാർഡും മെമെന്റോയും.",
       eligibility_verification="verified", documents_verification="verified", apply_verification="partial",
       notes="2025 KFWFB guideline p.29 (scheme 13). 'Active membership' (സജീവ അംഗത്വം) is encoded as membership with contributions paid, matching document 4 (certificate of no arrears). The first-attempt rule is part of the family-event option wording. Applications open only after the Commissioner's notification and go to the Board's Regional / Junior Executive.")
cond("FISH-22", "g0", 0, "livelihood", "includes", "fishing", "മത്സ്യത്തൊഴിലാളി കുടുംബങ്ങളിലെ കുട്ടികളുടെ വിദ്യാഭ്യാസ നിലവാരം ഉയർത്തുന്നതിന് പ്രോത്സാഹനം നൽകുന്നതിനായി ലക്ഷ്യമിട്ടിട്ടുള്ളതാണ് ഈ പദ്ധതി.", "p.29", K)
cond("FISH-22", "c1", 1, "family_event", "includes", "plus_two_all_aplus", "ഹയർ സെക്കന്ററി (+2) വൊക്കേഷണൽ ഹയർ സെക്കന്ററി പരീക്ഷകളിൽ എല്ലാ വിഷയങ്ങൾക്കും A+ ലഭിക്കുന്ന വിദ്യാർത്ഥികൾക്ക് 5000/- രൂപ വീതം ഈ പദ്ധതി പ്രകാരം ക്യാഷ് അവാർഡും മെമൊന്റോയും നൽകുന്നു.", "p.29", K)
cond("FISH-22", "c2", 2, "kfwfb_member", "eq", "yes", Q22M, "p.29, eligibility", K, changeable="yes", how_en=HOW_KB_EN, how_ml=HOW_KB_ML)
cond("FISH-22", "c3", 3, "kfwfb_contributions_paid", "eq", "yes", Q22M, "p.29, eligibility and document 4", K, changeable="yes",
     how_en="Clear any arrears of Welfare Fund contribution at the Fisheries Office.", how_ml="ക്ഷേമനിധി വിഹിതത്തിലെ കുടിശ്ശിക ഫിഷറീസ് ഓഫീസിൽ അടച്ചുതീർക്കുക.")
docs_for("FISH-22", [("final_mark_list", K, "അവസാന വർഷ പരീക്ഷയുടെ മാർക്ക് ലിസ്റ്റിന്റെ ശരിപ്പകർപ്പ്"),
                     ("sslc_book_age", K, "വയസ്സ് തെളിയിക്കുന്ന എസ്.എസ്.എൽ.സി ബുക്കിന്റെ ശരി പകർപ്പ്"),
                     ("parent_fisher_certificate", K, "രക്ഷിതാവ് മത്സ്യത്തൊഴിലാളി ആണെന്ന് തെളിയിക്കുന്നതിനുള്ള സർട്ടിഫിക്കറ്റിന്റെ ശരി പകർപ്പ്"),
                     ("contribution_no_arrears_certificate", K, "വിഹിതം കുടിശ്ശികയില്ലാതെ അടച്ചിട്ടുണ്ടെന്നതിനുള്ള സർട്ടിഫിക്കറ്റും പാസ് ബുക്കിലെ ബന്ധപ്പെട്ട പേജിന്റെ ഫോട്ടോസ്റ്റാറ്റ് കോപ്പിയും.")])
apply_for("FISH-22", [dict(type_id=FO, mode="in_person",
                           note_en="Watch for the Commissioner's notification after the results. Apply to the Board's Regional Executive / Junior Executive as it says; the student and parent both sign. Ask at the Fisheries office for the Regional Executive's address.",
                           note_ml="ഫലത്തിന് ശേഷം കമ്മീഷണർ പുറപ്പെടുവിക്കുന്ന വിജ്ഞാപനം ശ്രദ്ധിക്കുക. അതനുസരിച്ച് റീജിയണൽ എക്സിക്യൂട്ടീവ് / ജൂനിയർ എക്സിക്യൂട്ടീവിന് അപേക്ഷിക്കുക; വിദ്യാർത്ഥിയും രക്ഷകർത്താവും ഒപ്പിടണം. റീജിയണൽ എക്സിക്യൂട്ടീവിന്റെ വിലാസം ഫിഷറീസ് ഓഫീസിൽ ചോദിക്കുക.",
                           source_id=K, quote="ഇത് സംബന്ധിച്ച് കമ്മീഷണർ പുറപ്പെടുവിക്കുന്ന വിജ്ഞാപന പ്രകാരം നിബന്ധനകൾക്ക് വിധേയമായി അപേക്ഷകൾ ബന്ധപ്പെട്ട റീജിയണൽ എക്സിക്യൂട്ടീവ്/ജൂനിയർ എക്സിക്യൂട്ടീവിന് സമർപ്പിക്കാവുന്നതാണ്.")])
