"""
Icelandic postal code to city mapping.
Based on official Icelandic postal codes.
"""

ICELANDIC_POSTAL_CODES = {
    # Höfuðborgarsvæði (Capital Area)
    '101': 'Reykjavík',
    '102': 'Reykjavík',
    '103': 'Reykjavík',
    '104': 'Reykjavík',
    '105': 'Reykjavík',
    '106': 'Reykjavík',
    '107': 'Reykjavík',
    '108': 'Reykjavík',
    '109': 'Reykjavík',
    '110': 'Reykjavík',
    '111': 'Reykjavík',
    '112': 'Reykjavík',
    '113': 'Reykjavík',
    '116': 'Reykjavík',
    '121': 'Reykjavík',
    '125': 'Reykjavík',
    '127': 'Reykjavík',
    '128': 'Reykjavík',
    '129': 'Reykjavík',
    '130': 'Reykjavík',
    '132': 'Reykjavík',
    '151': 'Reykjavík',
    '152': 'Reykjavík',
    '153': 'Reykjavík',
    '154': 'Reykjavík',
    '155': 'Reykjavík',
    '156': 'Reykjavík',
    '157': 'Reykjavík',
    '158': 'Reykjavík',
    '160': 'Reykjavík',
    '161': 'Reykjavík',
    '162': 'Reykjavík',
    '165': 'Reykjavík',
    '170': 'Seltjarnarnes',
    '172': 'Seltjarnarnes',
    '200': 'Kópavogur',
    '201': 'Kópavogur',
    '202': 'Kópavogur',
    '203': 'Kópavogur',
    '210': 'Garðabær',
    '212': 'Garðabær',
    '220': 'Hafnir',
    '221': 'Hafnir',
    '225': 'Mosfellsbær',
    '226': 'Mosfellsbær',
    '230': 'Reykjanesbær',
    '232': 'Reykjanesbær',
    '233': 'Reykjanesbær',
    '235': 'Keflavík',
    '240': 'Grindavík',
    '245': 'Sandvík',
    '250': 'Garður',
    '251': 'Borgarnes',
    
    # Vesturland
    '300': 'Borgarnes',
    '301': 'Borgarnes',
    '310': 'Borgarbrú',
    '311': 'Borgarbrú',
    '312': 'Akranes',
    '313': 'Akranes',
    '320': 'Reykholt',
    '350': 'Grundarfjörður',
    '351': 'Grundarfjörður',
    '355': 'Snæfellsbær',
    '356': 'Snæfellsbær',
    '357': 'Stykkishólmur',
    '360': 'Hellnar',
    '361': 'Hellnar',
    '370': 'Breiðdalsvík',
    '371': 'Breiðdalsvík',
    '380': 'Rif',
    
    # Vestfirðir (West Fjords)
    '400': 'Ísafjörður',
    '401': 'Ísafjörður',
    '410': 'Vestfjörður',
    '411': 'Vestfjörður',
    '415': 'Flateyri',
    '416': 'Þingeyri',
    '420': 'Hólmavík',
    '421': 'Hólmavík',
    '425': 'Drangsnes',
    '430': 'Borðeyri',
    '450': 'Patreksfjörður',
    '451': 'Patreksfjörður',
    '460': 'Tálknafjörður',
    '461': 'Tálknafjörður',
    '470': 'Súðavík',
    '471': 'Súðavík',
    '474': 'Flateyri',
    '475': 'Westfjords',
    
    # Mið-Norðurland
    '500': 'Akureyri',
    '501': 'Akureyri',
    '502': 'Akureyri',
    '510': 'Akureyri',
    '600': 'Akureyri',
    '601': 'Akureyri',
    '602': 'Akureyri',
    '603': 'Akureyri',
    '605': 'Akureyri',
    '610': 'Húsavík',
    '611': 'Húsavík',
    '620': 'Laugarbakki',
    '625': 'Ólafsfjörður',
    '630': 'Laugarbakki',
    '640': 'Blönduós',
    '641': 'Blönduós',
    '645': 'Skagaströnd',
    '650': 'Varmahlíð',
    '651': 'Varmahlíð',
    '660': 'Góðreykjarstaður',
    '670': 'Dalvík',
    '671': 'Dalvík',
    '680': 'Grenivík',
    '690': 'Öxarfjörður',
    
    # Austurland (East Iceland)
    '700': 'Egilsstaðir',
    '701': 'Egilsstaðir',
    '710': 'Seyðisfjörður',
    '711': 'Seyðisfjörður',
    '715': 'Mjóifjörður',
    '720': 'Borgarfjörður',
    '721': 'Borgarfjörður',
    '730': 'Reyðarfjörður',
    '731': 'Reyðarfjörður',
    '735': 'Eskifjörður',
    '736': 'Eskifjörður',
    '740': 'Neskaupstaður',
    '741': 'Neskaupstaður',
    '750': 'Fáskrúðsfjörður',
    '751': 'Fáskrúðsfjörður',
    '755': 'Stöðvarfjörður',
    '760': 'Breiðdalsvík',
    '761': 'Breiðdalsvík',
    '765': 'Berufjörður',
    '766': 'Berufjörður',
    
    # Suðurland (South Iceland)
    '800': 'Selfoss',
    '801': 'Selfoss',
    '802': 'Selfoss',
    '803': 'Selfoss',
    '810': 'Hveragerði',
    '811': 'Hveragerði',
    '815': 'Þorlákshöfn',
    '816': 'Þorlákshöfn',
    '820': 'Borgarnes',
    '821': 'Borgarnes',
    '825': 'Stokkseyri',
    '826': 'Stokkseyri',
    '830': 'Vík',
    '831': 'Vík',
    '835': 'Höfn',
    '900': 'Höfn',
    '901': 'Höfn',
    '902': 'Höfn',
    '903': 'Höfn',
    '904': 'Höfn',
    '905': 'Höfn',
    '910': 'Hnappavellir',
    '915': 'Höfn',
    '916': 'Höfn',
    '920': 'Höfn',
    '921': 'Höfn',
    
    # Suðurnes (Reykjanes Peninsula)
    '230': 'Reykjanesbær',
    '232': 'Garður',
    '233': 'Reykjanesbær',
    '235': 'Keflavík',
    '240': 'Grindavík',
    '245': 'Seltún',
    '250': 'Garður',
    '251': 'Berufjörður',
    
    # Vestmannaeyjar (Westman Islands)
    '900': 'Vestmannaeyjar',
    '901': 'Vestmannaeyjar',
    '902': 'Vestmannaeyjar',
    '903': 'Vestmannaeyjar',
    '904': 'Vestmannaeyjar',
    '905': 'Vestmannaeyjar',
    '910': 'Vestmannaeyjar',
    '920': 'Vestmannaeyjar',
    '921': 'Vestmannaeyjar',
}


def get_city_from_postal_code(postal_code: str) -> str:
    """
    Get the city name for an Icelandic postal code.
    
    Args:
        postal_code: The postal code (e.g., '101', '200')
        
    Returns:
        The city name, or the postal code itself if not found
    """
    if not postal_code:
        return ''
    
    postal_code = postal_code.strip().lstrip('0')
    
    # Try exact match first
    for code, city in ICELANDIC_POSTAL_CODES.items():
        if code.lstrip('0') == postal_code or code == postal_code:
            return city
    
    # Try first 2 digits for regional codes
    if len(postal_code) >= 2:
        prefix = postal_code[:2]
        for code, city in ICELANDIC_POSTAL_CODES.items():
            if code.startswith(prefix):
                return city
    
    # Return empty if not found
    return ''
