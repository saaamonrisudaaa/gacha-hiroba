/* ===========================================================================
   店舗データ（実データ）
   ★ 店舗を増やすときは、この配列にオブジェクトを1つ追加するだけ。
      id は URL に使う識別子（半角英数・ハイフン）。重複しないように。
      region: kanto / kansai / tokai / kyushu / tohoku / chugoku
   =========================================================================== */
window.GH_SPOTS = [

  /* ───────────── 東京都 ───────────── */
  {
    id: 'ggmori-shinjuku-subnade',
    brand: 'ガチャガチャの森',
    name: 'ガチャガチャの森 新宿サブナード店',
    region: 'kanto',
    pref: '東京都',
    area: '東京都・新宿',
    zip: '160-0021',
    address: '東京都新宿区歌舞伎町1丁目 靖国通り下 新宿サブナード地下街内 401区画',
    tel: '080-3398-8708',
    hours: '10:30〜21:00',
    machines: 1050,
    access: '新宿サブナード地下街内（西武新宿駅・新宿駅・新宿三丁目駅 至近）'
  },
  {
    id: 'ggmori-shinjuku-subnade-east',
    brand: 'ガチャガチャの森',
    name: 'ガチャガチャの森 新宿サブナードEAST店',
    region: 'kanto',
    pref: '東京都',
    area: '東京都・新宿',
    zip: '160-0021',
    address: '東京都新宿区歌舞伎町1丁目 靖国通り下 新宿サブナード地下街内 C-15号・C-21号',
    tel: '080-3965-1320',
    hours: '10:30〜21:00',
    machines: 450,
    access: '新宿サブナード地下街内（西武新宿駅・新宿駅・新宿三丁目駅 至近）'
  },
  {
    id: 'ggmori-olinas-kinshicho',
    brand: 'ガチャガチャの森',
    name: 'ガチャガチャの森 オリナス錦糸町店',
    region: 'kanto',
    pref: '東京都',
    area: '東京都・錦糸町',
    zip: '130-0012',
    address: '東京都墨田区太平4-1-2 オリナス錦糸町 3F',
    tel: '080-4114-3729',
    hours: '10:00〜21:00',
    machines: 660,
    access: 'オリナス錦糸町 3F（錦糸町駅より徒歩圏）'
  },
  {
    id: 'ggmori-jiyugaoka',
    brand: 'ガチャガチャの森',
    name: 'ガチャガチャの森 自由が丘店',
    region: 'kanto',
    pref: '東京都',
    area: '東京都・自由が丘',
    zip: '158-0083',
    address: '東京都世田谷区奥沢5-26-12 XAREA自由が丘 1F',
    tel: '090-1502-2852',
    hours: '11:00〜20:00',
    machines: 570,
    access: 'XAREA自由が丘 1F'
  },
  {
    id: 'ggmori-seiyu-ogikubo',
    brand: 'ガチャガチャの森',
    name: 'ガチャガチャの森 西友荻窪店',
    region: 'kanto',
    pref: '東京都',
    area: '東京都・荻窪',
    zip: '167-0043',
    address: '東京都杉並区上荻1-9-1 タウンセブン 西友荻窪店 7F',
    tel: '080-4002-1652',
    hours: '10:00〜21:00',
    machines: 470,
    access: 'タウンセブン（西友荻窪店）7F'
  },
  {
    id: 'ggmori-ikebukuro-sunshine-alta',
    brand: 'ガチャガチャの森',
    name: 'ガチャガチャの森 池袋サンシャインシティアルタ店',
    region: 'kanto',
    pref: '東京都',
    area: '東京都・池袋',
    zip: '170-8630',
    address: '東京都豊島区東池袋3-1-3 池袋サンシャインシティアルタ 1F',
    tel: '080-4435-4582',
    hours: '11:00〜20:00',
    machines: 1240,
    access: '池袋サンシャインシティ アルタ 1F'
  },
  {
    id: 'ggmori-hachioji-opa',
    brand: 'ガチャガチャの森',
    name: 'ガチャガチャの森 八王子オーパ店',
    region: 'kanto',
    pref: '東京都',
    area: '東京都・八王子',
    zip: '192-0083',
    address: '東京都八王子市旭町1-12 八王子オーパ 4F',
    tel: '080-4439-7208',
    hours: '10:00〜21:00',
    machines: 830,
    access: '八王子オーパ 4F'
  },
  {
    id: 'ggmori-bic-tachikawa',
    brand: 'ガチャガチャの森',
    name: 'ガチャガチャの森 ビックカメラ立川店',
    region: 'kanto',
    pref: '東京都',
    area: '東京都・立川',
    zip: '190-0012',
    address: '東京都立川市曙町2-12-2 ビックカメラ立川店 7F',
    tel: '090-1996-0449',
    hours: '10:00〜21:00',
    machines: 770,
    access: 'ビックカメラ立川店 7F'
  },
  {
    id: 'ggmori-odakyu-machida',
    brand: 'ガチャガチャの森',
    name: 'ガチャガチャの森 小田急百貨店町田店',
    region: 'kanto',
    pref: '東京都',
    area: '東京都・町田',
    zip: '194-0013',
    address: '東京都町田市原町田6丁目12-20 小田急百貨店 町田店 8F',
    tel: '080-3497-0599',
    hours: '10:00〜20:00',
    machines: 880,
    access: '小田急百貨店 町田店 8F'
  },
  {
    id: 'ggmori-aeonmall-musashimurayama',
    brand: 'ガチャガチャの森',
    name: 'ガチャガチャの森 イオンモールむさし村山店',
    region: 'kanto',
    pref: '東京都',
    area: '東京都・武蔵村山',
    zip: '208-0022',
    address: '東京都武蔵村山市榎1丁目1-3 イオンモールむさし村山 3F',
    tel: '080-7416-6555',
    hours: '10:00〜21:00',
    machines: 650,
    access: 'イオンモールむさし村山 3F'
  },

  /* ───────────── 神奈川県 ───────────── */
  {
    id: 'ggmori-sakuragicho-colette',
    brand: 'ガチャガチャの森',
    name: 'ガチャガチャの森 桜木町コレットマーレ店',
    region: 'kanto',
    pref: '神奈川県',
    area: '神奈川県・桜木町',
    zip: '231-0062',
    address: '神奈川県横浜市中区桜木町1-1-7 コレットマーレ 5F',
    tel: '090-2950-6352',
    hours: '11:00〜20:00',
    machines: 1180,
    access: 'コレットマーレ 5F（桜木町駅 至近）'
  },
  {
    id: 'ggmori-northport-mall',
    brand: 'ガチャガチャの森',
    name: 'ガチャガチャの森 ノースポート・モール店',
    region: 'kanto',
    pref: '神奈川県',
    area: '神奈川県・センター北',
    zip: '224-0003',
    address: '神奈川県横浜市都筑区中川中央1-25-1 ノースポート・モール 4F',
    tel: '080-4406-3386',
    hours: '10:00〜21:00',
    machines: 750,
    access: 'ノースポート・モール 4F（センター北駅 至近）'
  },
  {
    id: 'ggmori-coasca-yokosuka',
    brand: 'ガチャガチャの森',
    name: 'ガチャガチャの森 コースカベイサイドストアーズ店',
    region: 'kanto',
    pref: '神奈川県',
    area: '神奈川県・横須賀',
    zip: '238-0041',
    address: '神奈川県横須賀市本町2-1-12 コースカベイサイドストアーズ 4F',
    tel: '080-4423-5630',
    hours: '10:00〜21:00',
    machines: 700,
    access: 'コースカベイサイドストアーズ 4F'
  },

  /* ───────────── 埼玉県 ───────────── */
  {
    id: 'ggmori-aeonmall-kawaguchi-maekawa',
    brand: 'ガチャガチャの森',
    name: 'ガチャガチャの森 イオンモール川口前川店',
    region: 'kanto',
    pref: '埼玉県',
    area: '埼玉県・川口',
    zip: '333-0842',
    address: '埼玉県川口市前川1-1-11 イオンモール川口前川 2F',
    tel: '080-3259-9624',
    hours: '10:00〜21:00',
    machines: 870,
    access: 'イオンモール川口前川 2F'
  },
  {
    id: 'ggmori-aeonmall-kasukabe',
    brand: 'ガチャガチャの森',
    name: 'ガチャガチャの森 イオンモール春日部店',
    region: 'kanto',
    pref: '埼玉県',
    area: '埼玉県・春日部',
    zip: '344-0122',
    address: '埼玉県春日部市下柳420-1 イオンモール春日部 2F',
    tel: '070-1356-9145',
    hours: '10:00〜21:00',
    machines: 440,
    access: 'イオンモール春日部 2F'
  },
  {
    id: 'ggmori-papa-ageo',
    brand: 'ガチャガチャの森',
    name: 'ガチャガチャの森 PAPA上尾ショッピングアヴェニュー店',
    region: 'kanto',
    pref: '埼玉県',
    area: '埼玉県・上尾',
    zip: '362-0015',
    address: '埼玉県上尾市緑丘3-3-11 PAPA上尾ショッピングアヴェニュー プリンセス棟 2F',
    tel: '080-3965-1408',
    hours: '10:00〜20:00',
    machines: 700,
    access: 'PAPA上尾ショッピングアヴェニュー プリンセス棟 2F（上尾駅 至近）'
  },
  {
    id: 'ggmori-aeon-laketown-kaze',
    brand: 'ガチャガチャの森',
    name: 'ガチャガチャの森 イオンレイクタウンkaze店',
    region: 'kanto',
    pref: '埼玉県',
    area: '埼玉県・越谷',
    zip: '343-0828',
    address: '埼玉県越谷市レイクタウン4丁目2番地2 イオンレイクタウンkaze 3F',
    tel: '080-3358-9373',
    hours: '10:00〜21:00',
    machines: 560,
    access: 'イオンレイクタウン kaze 3F（越谷レイクタウン駅 至近）'
  }

];
