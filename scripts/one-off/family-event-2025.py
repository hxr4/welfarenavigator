EVENTS = [
    ("daughter_marriage_60_days", "daughter_marriage", "A daughter is getting married, or married in the last 60 days", "മകളുടെ വിവാഹം അടുത്ത് നടക്കാനുണ്ട്, അല്ലെങ്കിൽ കഴിഞ്ഞ 60 ദിവസത്തിനുള്ളിൽ നടന്നു"),
    ("child_sslc_8_aplus", "sslc_8_aplus", "A child got A+ in at least 8 subjects in this year's SSLC", "ഈ വർഷത്തെ എസ്.എസ്.എൽ.സി-യിൽ കുട്ടിക്ക് കുറഞ്ഞത് 8 വിഷയങ്ങളിൽ എ+ ലഭിച്ചു"),
    ("serious_illness", "serious_illness", "Someone needs treatment for heart disease, kidney disease, cancer, a brain tumour, paralysis, or a mental illness that can be cured", "ഹൃദ്രോഗം, വൃക്കരോഗം, ക്യാൻസർ, തലച്ചോറിലെ ട്യൂമർ, തളർവാതം, ചികിൽസിച്ച് ഭേദമാക്കാവുന്ന മാനസികരോഗം എന്നിവയിൽ ഒന്നിന് ചികിൽസ ആവശ്യമുണ്ട്"),
    ("accident_unable_7_days", "accident", "A fisherman was hurt in an accident and could not work for 7 days or more", "അപകടം മൂലം മത്സ്യത്തൊഴിലാളിക്ക് 7 ദിവസമോ അതിൽ കൂടുതലോ ജോലി ചെയ്യാൻ കഴിഞ്ഞില്ല"),
    ("member_death", "member_death", "A fisherman in the family who was a Welfare Fund member has died", "കുടുംബത്തിലെ ക്ഷേമനിധി അംഗമായ മത്സ്യത്തൊഴിലാളി മരിച്ചു"),
    ("dependant_died", "dependant_death", "In the last 3 months, a fisherman's father, mother, wife or husband, minor son or unmarried daughter died", "കഴിഞ്ഞ 3 മാസത്തിനുള്ളിൽ മത്സ്യത്തൊഴിലാളിയുടെ അച്ഛൻ, അമ്മ, ഭാര്യ/ഭർത്താവ്, മൈനറായ മകൻ, അവിവാഹിതയായ മകൾ എന്നിവരിൽ ആരെങ്കിലും മരിച്ചു"),
]
upsert(F, "fact_id", dict(fact_id="family_event", type="multi", label_en="Recent family events", label_ml="കുടുംബത്തിലെ സമീപകാല സംഭവങ്ങൾ",
    question_en="Has any of these happened in the family? Choose all that apply.",
    question_ml="ഇവയിൽ ഏതെങ്കിലും കുടുംബത്തിൽ ഉണ്ടായിട്ടുണ്ടോ? ബാധകമായതെല്ലാം തിരഞ്ഞെടുക്കുക.",
    help_en="Each of these opens a different Welfare Fund Board scheme. Choose None if nothing applies.",
    help_ml="ഇവ ഓരോന്നും ക്ഷേമനിധി ബോർഡിന്റെ ഓരോ പദ്ധതിയുമായി ബന്ധപ്പെട്ടതാണ്. ഒന്നും ബാധകമല്ലെങ്കിൽ 'ഇവയൊന്നുമല്ല' തിരഞ്ഞെടുക്കുക.",
    sensitivity="medium", ask_order=19))
delete_where(O, fact_id="family_event")
for _, v, en, ml in EVENTS:
    append(O, dict(fact_id="family_event", value=v, label_en=en, label_ml=ml))
append(O, dict(fact_id="family_event", value="none", label_en="None of these", label_ml="ഇവയൊന്നുമല്ല"))
for old, v, _, _ in EVENTS:
    for r in find(C, fact_id=old):
        setv(C, r, "fact_id", "family_event")
        setv(C, r, "op", "includes")
        setv(C, r, "value", v)
    delete_where(F, fact_id=old)
    delete_where(O, fact_id=old)
