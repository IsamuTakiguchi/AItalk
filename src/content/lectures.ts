import type { UnitLecture } from "./types";

/**
 * The opening explanation for each unit, keyed by unit id.
 *
 * Kept out of the course files because it is a different kind of content: the
 * courses describe what the learner *does*, these describe what they should
 * *understand* before doing it.
 *
 * Every unit has slides. A supporting YouTube video may also be found at
 * runtime, but it is never required — a missing, deleted or non-embeddable
 * video leaves the lecture fully intact.
 */
export const UNIT_LECTURES: Record<string, UnitLecture> = {
  // --- はじめての英会話 ---------------------------------------------------
  "basics-intro": {
    titleJa: "自己紹介で大事なのは「正しさ」より「続けやすさ」",
    goalJa: "名前・出身・仕事・趣味を、詰まらずに一続きで言えるようになる",
    youtubeQuery: "英語 自己紹介 フレーズ 初心者 中学英語",
    slides: [
      {
        headingJa: "完璧な一文より、短い三文",
        bodyJa:
          "自己紹介でつまずく一番の原因は、長い一文を作ろうとすることです。英語は短い文を並べるほうが自然に聞こえます。"
          + "「私は東京に住んでいて大阪出身のエンジニアです」を一文にしようとせず、三つに割ってください。",
        example: {
          en: "I'm Yuki. I'm from Osaka. I live in Tokyo now.",
          ja: "ユキです。大阪出身です。今は東京に住んでいます。",
        },
      },
      {
        headingJa: "be動詞と一般動詞を混ぜない",
        bodyJa:
          "日本語の「です」に引っぱられて "
          + "I am work at a company のように be動詞と一般動詞を重ねる間違いが非常に多く起きます。"
          + "動詞は文にひとつ、と覚えてください。",
        example: {
          en: "I work at a small software company.",
          ja: "小さなソフトウェア会社で働いています。",
        },
      },
      {
        headingJa: "現在形は「いつもそうしていること」",
        bodyJa:
          "自己紹介で使う現在形は、今この瞬間ではなく習慣を表します。"
          + "毎日のこと・ふだんのことは現在形でそのまま言えます。",
        example: {
          en: "I usually practice English on the train.",
          ja: "ふだんは電車で英語を練習しています。",
        },
      },
      {
        headingJa: "詰まったときに使う一言を先に用意する",
        bodyJa:
          "黙ってしまうのが一番もったいないので、「わからない」を英語で言えるようにしておきましょう。"
          + "これが言えるだけで会話が途切れなくなります。",
        example: {
          en: "Sorry, how do I say this in English?",
          ja: "すみません、これは英語で何と言いますか？",
        },
      },
    ],
  },

  "basics-shop": {
    titleJa: "お店では「丁寧さ」より「はっきり」が大事",
    goalJa: "注文・値段の確認・支払いまでを、自分から切り出せるようになる",
    youtubeQuery: "英語 カフェ 注文 フレーズ 海外旅行 店員",
    slides: [
      {
        headingJa: "Can I have 〜 で全部いける",
        bodyJa:
          "店での注文は Can I have 〜, please? がほぼ万能です。"
          + "I want 〜 は子どもっぽく、ぶっきらぼうにも聞こえるので避けましょう。",
        example: {
          en: "Can I have a small latte, please?",
          ja: "スモールのラテをお願いします。",
        },
      },
      {
        headingJa: "店員の決まり文句を先に知っておく",
        bodyJa:
          "For here or to go?（店内か持ち帰りか）は必ず聞かれます。"
          + "聞き取れる前提で身構えておくと、それだけで固まらずに済みます。",
        example: { en: "For here, please.", ja: "店内でお願いします。" },
      },
      {
        headingJa: "値段は How much で短く聞く",
        bodyJa:
          "How much does it cost? と長くしなくて構いません。"
          + "How much is this? で十分通じますし、そのほうが自然です。",
        example: { en: "How much is that altogether?", ja: "全部でいくらですか？" },
      },
      {
        headingJa: "間違いは早めに、やわらかく伝える",
        bodyJa:
          "注文が違ったとき、黙って受け取る必要はありません。"
          + "I think there's a mistake（間違いがあるようです）と言えば角が立ちません。"
          + "I think を付けるだけで断定が弱まります。",
        example: {
          en: "Sorry, I think there's a mistake with my order.",
          ja: "すみません、注文が間違っている気がします。",
        },
      },
    ],
  },

  "basics-directions": {
    titleJa: "道をたずねるときは、聞き返しまでがワンセット",
    goalJa: "行き方をたずね、聞き取れなかった部分を確認して、復唱できるようになる",
    youtubeQuery: "英語 道案内 道をたずねる フレーズ 旅行英会話",
    slides: [
      {
        headingJa: "まず Excuse me で相手を止める",
        bodyJa:
          "いきなり質問を始めると相手は聞く体勢になっていません。"
          + "Excuse me. といったん区切り、相手がこちらを向いてから本題に入ります。",
        example: {
          en: "Excuse me, how do I get to the station?",
          ja: "すみません、駅へはどう行けばいいですか？",
        },
      },
      {
        headingJa: "答えは聞き取れなくて当たり前",
        bodyJa:
          "道案内の返答は早口で、知らない地名も混ざります。全部聞き取ろうとしないでください。"
          + "大事なのは「右か左か」「どのくらいか」の二点だけです。",
        example: { en: "Should I turn left or right?", ja: "左に曲がりますか、右ですか？" },
      },
      {
        headingJa: "復唱して確認する",
        bodyJa:
          "聞いた内容をそのまま言い返すと、間違いをその場で訂正してもらえます。"
          + "So, ... Is that correct? の形が使いやすいです。",
        example: {
          en: "So I go straight and then turn right. Is that correct?",
          ja: "まっすぐ行って、それから右ですね。合っていますか？",
        },
      },
      {
        headingJa: "聞き返しは失礼ではない",
        bodyJa:
          "I didn't catch that（聞き取れませんでした）は、相手を責めない自然な聞き返しです。"
          + "What? と単独で返すとぶっきらぼうに響くので、こちらを使いましょう。",
        example: {
          en: "Sorry, I didn't catch that. Could you repeat it?",
          ja: "すみません、聞き取れませんでした。もう一度お願いできますか？",
        },
      },
    ],
  },

  // --- 日常会話をこなす ---------------------------------------------------
  "daily-travel": {
    titleJa: "旅先の英語は、型を覚えれば応用が利く",
    goalJa: "チェックイン・依頼・条件確認を、ひとつの型から組み立てられるようになる",
    youtubeQuery: "英語 ホテル チェックイン 空港 フレーズ 旅行英会話",
    slides: [
      {
        headingJa: "予約の確認は under という一語",
        bodyJa:
          "「〜の名前で予約しています」は under を使います。"
          + "I reserved by my name のように by を使う間違いが多いので、under で覚えてください。",
        example: {
          en: "I have a reservation under the name Tanaka.",
          ja: "田中の名前で予約しています。",
        },
      },
      {
        headingJa: "依頼は Could I 〜? が万能",
        bodyJa:
          "部屋の変更も荷物預かりも、Could I 〜? / Would it be possible to 〜? で丁寧に頼めます。"
          + "Can より Could のほうが押しつけが弱く、旅先では使いやすい形です。",
        example: {
          en: "Could I have a room on a higher floor?",
          ja: "もう少し上の階の部屋にできますか？",
        },
      },
      {
        headingJa: "included で「込みかどうか」を聞く",
        bodyJa:
          "朝食・税・サービス料が料金に含まれるかは、included ひとつで全部聞けます。"
          + "料金トラブルを避けるために、先に確認する癖をつけましょう。",
        example: { en: "Is breakfast included in the price?", ja: "朝食は料金に含まれていますか？" },
      },
      {
        headingJa: "遅れやトラブルは理由とセットで",
        bodyJa:
          "英語では、状況を伝えるときに理由を添えると受け入れられやすくなります。"
          + "so（だから）でつなぐだけで十分です。",
        example: {
          en: "My flight was delayed, so I arrived late.",
          ja: "飛行機が遅れたので、到着が遅くなりました。",
        },
      },
    ],
  },

  "daily-smalltalk": {
    titleJa: "雑談は内容より「返し方」で決まる",
    goalJa: "相手の話に反応し、自分の話を足して、会話を続けられるようになる",
    youtubeQuery: "英語 雑談 スモールトーク 相槌 リアクション フレーズ",
    slides: [
      {
        headingJa: "相槌がないと「聞いていない人」になる",
        bodyJa:
          "日本語の「うんうん」に当たるものが英語にも必要です。"
          + "Oh really? / That sounds great. を挟むだけで、会話の雰囲気がまったく変わります。",
        example: { en: "Oh really? That sounds great.", ja: "へえ、本当に？それはいいね。" },
      },
      {
        headingJa: "質問に答えて終わらせない",
        bodyJa:
          "Yes / No だけで返すと会話が止まります。"
          + "答えのあとに一言足すのが英語の雑談の基本形です。「答え＋一言」とだけ覚えてください。",
        example: {
          en: "Yes, I did. I went hiking with my friends.",
          ja: "うん、したよ。友だちとハイキングに行ったんだ。",
        },
      },
      {
        headingJa: "自分の話に引き取る",
        bodyJa:
          "相手の話題に自分の経験を重ねると、一気に会話らしくなります。"
          + "The same thing happened to me. は使い回しの利く一文です。",
        example: {
          en: "The same thing happened to me last month.",
          ja: "先月、同じことが私にもあったよ。",
        },
      },
      {
        headingJa: "話題を変えるときの合図",
        bodyJa:
          "唐突に話題を変えると相手が戸惑います。"
          + "Speaking of which / Anyway を前に置くと、変えますよという合図になります。",
        example: {
          en: "Anyway, what have you been up to lately?",
          ja: "ところで、最近どうしてるの？",
        },
      },
    ],
  },

  "daily-trouble": {
    titleJa: "困ったときこそ、短く正確に",
    goalJa: "症状や状況を、いつから・何が、の順で説明できるようになる",
    youtubeQuery: "英語 体調不良 症状 説明 薬局 病院 フレーズ",
    slides: [
      {
        headingJa: "「いつから」は since と for",
        bodyJa:
          "since は起点（昨日から）、for は期間（三日間）です。"
          + "ここを取り違えると症状の深刻さが伝わらないので、区別して覚えてください。",
        example: {
          en: "I've had a headache since yesterday morning.",
          ja: "昨日の朝から頭痛がします。",
        },
      },
      {
        headingJa: "症状は have で言える",
        bodyJa:
          "頭痛・熱・咳、ほとんどの症状は I have 〜 で表せます。"
          + "難しい医学用語を探すより、have で言い切るほうが確実に通じます。",
        example: { en: "I have a fever and a sore throat.", ja: "熱と喉の痛みがあります。" },
      },
      {
        headingJa: "助けを求める一文を用意しておく",
        bodyJa:
          "慌てているときほど言葉が出ません。"
          + "Could you help me? を反射で言えるようにしておくと、その後を相手が導いてくれます。",
        example: {
          en: "Could you help me? I'm not sure what to do.",
          ja: "助けてもらえますか？どうすればいいか分かりません。",
        },
      },
      {
        headingJa: "謝罪と要件は分けて言う",
        bodyJa:
          "遅刻や変更を伝えるとき、謝罪と要件を一文に詰め込むと分かりにくくなります。"
          + "I'm sorry, but 〜 と区切って、要件を後ろに置きましょう。",
        example: {
          en: "I'm really sorry, but I'll be about ten minutes late.",
          ja: "本当にすみませんが、10分ほど遅れます。",
        },
      },
    ],
  },

  // --- ビジネス英語の基礎 -------------------------------------------------
  "business-meeting": {
    titleJa: "会議の英語は、反対の言い方で差がつく",
    goalJa: "反対意見を、相手を否定せずに理由つきで述べられるようになる",
    youtubeQuery: "ビジネス英語 会議 意見 反対 表現 フレーズ",
    slides: [
      {
        headingJa: "まず受け止めてから反対する",
        bodyJa:
          "英語の会議では、いきなり No と言うと協調性がないと受け取られます。"
          + "That's a fair point, but 〜 のように、一度受け止めてから自分の見方を出します。"
          + "日本語の「おっしゃることは分かりますが」と同じ働きです。",
        example: {
          en: "That's a fair point, but I see it slightly differently.",
          ja: "おっしゃることは分かりますが、私は少し違う見方をしています。",
        },
      },
      {
        headingJa: "懸念は concern という名詞で",
        bodyJa:
          "I don't like it は感情的に響きます。"
          + "My main concern is that 〜 とすると、個人の好き嫌いではなく論点として扱われます。",
        example: {
          en: "My main concern is that the timeline is too tight.",
          ja: "一番気になっているのは、スケジュールが厳しすぎることです。",
        },
      },
      {
        headingJa: "反対したら代案を出す",
        bodyJa:
          "英語の会議では、反対だけして終わると建設的でないと見なされます。"
          + "What if we 〜 instead? で必ず代案をセットにしてください。",
        example: { en: "What if we tested it first instead?", ja: "代わりに先に検証してはどうでしょう？" },
      },
      {
        headingJa: "確認は自分の理解として言う",
        bodyJa:
          "相手の発言を確認するとき、Do you mean 〜? は詰問に聞こえることがあります。"
          + "Just to make sure I understand（理解の確認ですが）と前置きすると角が立ちません。",
        example: {
          en: "Just to make sure I understand, are you suggesting we delay it?",
          ja: "確認させてください、延期するという提案でしょうか？",
        },
      },
    ],
  },

  "business-interview": {
    titleJa: "面接は、抽象論より具体例がすべて",
    goalJa: "強みを、具体的なエピソードとセットで語れるようになる",
    youtubeQuery: "英語 面接 自己PR 答え方 例文 ビジネス英語",
    slides: [
      {
        headingJa: "強みは一言＋具体例",
        bodyJa:
          "I'm hardworking のような形容詞だけでは何も伝わりません。"
          + "強みを述べたら必ず For example, 〜 で実際にやったことを続けてください。"
          + "面接官が知りたいのは性格ではなく行動です。",
        example: {
          en: "My strongest skill is breaking down complex problems. For example, at my last company...",
          ja: "一番の強みは複雑な問題を分解することです。たとえば前職では…",
        },
      },
      {
        headingJa: "経歴は現在完了で厚みを出す",
        bodyJa:
          "I worked there は終わった話、I've been working there は今も続いている話です。"
          + "継続を示す現在完了は、経験の厚みを伝えるのに向いています。",
        example: {
          en: "I've spent the last five years working in software development.",
          ja: "この5年間はソフトウェア開発の仕事をしてきました。",
        },
      },
      {
        headingJa: "考える時間を英語で確保する",
        bodyJa:
          "難しい質問に沈黙で応じると、答えられないと見なされます。"
          + "That's a good question. Let me think for a moment. と言えば、堂々と数秒稼げます。",
        example: {
          en: "That's a good question. Let me think for a moment.",
          ja: "いい質問ですね。少し考えさせてください。",
        },
      },
      {
        headingJa: "逆質問まで含めて面接",
        bodyJa:
          "質問がないと関心が薄いと受け取られます。"
          + "チームの働き方や最初の半年の期待値を聞くと、意欲が伝わります。",
        example: {
          en: "What would success look like in the first six months?",
          ja: "最初の半年で成果とされるのはどんなことでしょうか？",
        },
      },
    ],
  },
};
