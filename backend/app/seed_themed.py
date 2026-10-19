import json
from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.database import engine, SessionLocal, Base
from app.models import Deck, Word, UserProgress, User, UserSettings, ChapterProgress
from app.config import settings

DATA_DIR = Path(__file__).resolve().parent / "data"
THEMED_DECKS_FILE = DATA_DIR / "themed_decks.json"
N5_N4_VOCAB_FILE = DATA_DIR / "n5_n4_vocab.json"

RAW_VOCABULARY = [
    # --- DECK: n5-daily-essentials ---
    {"deck_slug": "n5-daily-essentials", "kanji": "私", "kana": "わたし", "romaji": "watashi", "meaning": "I; me", "jlpt": "N5", "pos": "pronoun", "ex_ja": "私は日本語を勉強しています。", "ex_en": "I am studying Japanese.", "mn": "Point to yourself: 'Watashi' is me."},
    {"deck_slug": "n5-daily-essentials", "kanji": "貴方", "kana": "あなた", "romaji": "anata", "meaning": "you", "jlpt": "N5", "pos": "pronoun", "ex_ja": "あなたのお名前は何ですか。", "ex_en": "What is your name?", "mn": "Anata sounds like 'another' person you address."},
    {"deck_slug": "n5-daily-essentials", "kanji": "はい", "kana": "はい", "romaji": "hai", "meaning": "yes; correct", "jlpt": "N5", "pos": "expression", "ex_ja": "はい、そうです。", "ex_en": "Yes, that is correct.", "mn": "'Hai' rhymes with affirmative high-five."},
    {"deck_slug": "n5-daily-essentials", "kanji": "いいえ", "kana": "いいえ", "romaji": "iie", "meaning": "no; not at all", "jlpt": "N5", "pos": "expression", "ex_ja": "いいえ、違います。", "ex_en": "No, it is different.", "mn": "Shaking head: 'ee-eh' no no."},
    {"deck_slug": "n5-daily-essentials", "kanji": "有難う", "kana": "ありがとう", "romaji": "arigatou", "meaning": "thank you", "jlpt": "N5", "pos": "expression", "ex_ja": "手伝ってくれてありがとう。", "ex_en": "Thank you for helping me.", "mn": "Ari (rare) + gatou (is hard to find) = thank you for this rare favor."},
    {"deck_slug": "n5-daily-essentials", "kanji": "済みません", "kana": "すみません", "romaji": "sumimasen", "meaning": "excuse me; I'm sorry", "jlpt": "N5", "pos": "expression", "ex_ja": "すみません、駅はどこですか。", "ex_en": "Excuse me, where is the station?", "mn": "Sue me (sumi) if I stepped on your foot, I'm sorry!"},
    {"deck_slug": "n5-daily-essentials", "kanji": "今", "kana": "いま", "romaji": "ima", "meaning": "now; right now", "jlpt": "N5", "pos": "noun", "ex_ja": "今、何時ですか。", "ex_en": "What time is it now?", "mn": "'I'm a' doing it right NOW."},
    {"deck_slug": "n5-daily-essentials", "kanji": "何", "kana": "なに", "romaji": "nani", "meaning": "what", "jlpt": "N5", "pos": "pronoun", "ex_ja": "これは何ですか。", "ex_en": "What is this?", "mn": "The anime meme 'NANI?!' = WHAT?!"},
    {"deck_slug": "n5-daily-essentials", "kanji": "誰", "kana": "だれ", "romaji": "dare", "meaning": "who", "jlpt": "N5", "pos": "pronoun", "ex_ja": "あの人は誰ですか。", "ex_en": "Who is that person?", "mn": "Who DARES challenge me?"},
    {"deck_slug": "n5-daily-essentials", "kanji": "どこ", "kana": "どこ", "romaji": "doko", "meaning": "where", "jlpt": "N5", "pos": "pronoun", "ex_ja": "お手洗いはどこですか。", "ex_en": "Where is the restroom?", "mn": "Where did the doctor (doko) go?"},

    # --- DECK: n5-numbers-time ---
    {"deck_slug": "n5-numbers-time", "kanji": "今日", "kana": "きょう", "romaji": "kyou", "meaning": "today", "jlpt": "N5", "pos": "noun", "ex_ja": "今日はいい天気ですね。", "ex_en": "The weather is nice today, isn't it?", "mn": "Kyo-to is sunny TODAY."},
    {"deck_slug": "n5-numbers-time", "kanji": "明日", "kana": "あした", "romaji": "ashita", "meaning": "tomorrow", "jlpt": "N5", "pos": "noun", "ex_ja": "明日、テストがあります。", "ex_en": "There is a test tomorrow.", "mn": "I'll ask her (ashita) out tomorrow."},
    {"deck_slug": "n5-numbers-time", "kanji": "昨日", "kana": "きのう", "romaji": "kinou", "meaning": "yesterday", "jlpt": "N5", "pos": "noun", "ex_ja": "昨日は雨が降りました。", "ex_en": "It rained yesterday.", "mn": "Keys? No, I lost them YESTERDAY (kinou)."},
    {"deck_slug": "n5-numbers-time", "kanji": "時間", "kana": "じかん", "romaji": "jikan", "meaning": "time; hours", "jlpt": "N5", "pos": "noun", "ex_ja": "時間があまりありません。", "ex_en": "I don't have much time.", "mn": "Ji (time) + kan (interval) = duration of time."},
    {"deck_slug": "n5-numbers-time", "kanji": "毎日", "kana": "まいにち", "romaji": "mainichi", "meaning": "every day", "jlpt": "N5", "pos": "noun", "ex_ja": "毎日、漢字を練習します。", "ex_en": "I practice kanji every day.", "mn": "Mai (every) + nichi (day) = every day."},
    {"deck_slug": "n5-numbers-time", "kanji": "朝", "kana": "あさ", "romaji": "asa", "meaning": "morning", "jlpt": "N5", "pos": "noun", "ex_ja": "毎朝７時に起きます。", "ex_en": "I wake up at 7 every morning.", "mn": "Sun rises ASAP in the morning (asa)."},
    {"deck_slug": "n5-numbers-time", "kanji": "夜", "kana": "よる", "romaji": "yoru", "meaning": "night; evening", "jlpt": "N5", "pos": "noun", "ex_ja": "夜、本を読みます。", "ex_en": "I read books at night.", "mn": "You're all (yoru) asleep at night."},
    {"deck_slug": "n5-numbers-time", "kanji": "週", "kana": "しゅう", "romaji": "shuu", "meaning": "week", "jlpt": "N5", "pos": "noun", "ex_ja": "来週、日本へ行きます。", "ex_en": "I will go to Japan next week.", "mn": "Shoo away the bad week."},

    # --- DECK: n5-food-dining ---
    {"deck_slug": "n5-food-dining", "kanji": "ご飯", "kana": "ごはん", "romaji": "gohan", "meaning": "cooked rice; meal", "jlpt": "N5", "pos": "noun", "ex_ja": "朝ご飯を食べましたか。", "ex_en": "Did you eat breakfast?", "mn": "Go-han sounds like go have a meal."},
    {"deck_slug": "n5-food-dining", "kanji": "水", "kana": "みず", "romaji": "mizu", "meaning": "water (cold)", "jlpt": "N5", "pos": "noun", "ex_ja": "お水を一杯ください。", "ex_en": "A glass of water, please.", "mn": "Miss you (mizu) like thirst for water in desert."},
    {"deck_slug": "n5-food-dining", "kanji": "お茶", "kana": "おちゃ", "romaji": "ocha", "meaning": "tea (green tea)", "jlpt": "N5", "pos": "noun", "ex_ja": "温かいお茶を飲みます。", "ex_en": "I drink warm green tea.", "mn": "Ocha sounds like matcha!"},
    {"deck_slug": "n5-food-dining", "kanji": "魚", "kana": "さかな", "romaji": "sakana", "meaning": "fish", "jlpt": "N5", "pos": "noun", "ex_ja": "日本の魚は新鮮です。", "ex_en": "Japanese fish is fresh.", "mn": "Sake + na: fish goes great with sake!"},
    {"deck_slug": "n5-food-dining", "kanji": "肉", "kana": "にく", "romaji": "niku", "meaning": "meat", "jlpt": "N5", "pos": "noun", "ex_ja": "今夜は牛肉のカレーです。", "ex_en": "Tonight is beef curry.", "mn": "Nick loves eating meat (niku)."},
    {"deck_slug": "n5-food-dining", "kanji": "野菜", "kana": "やさい", "romaji": "yasai", "meaning": "vegetable", "jlpt": "N5", "pos": "noun", "ex_ja": "もっと野菜を食べましょう。", "ex_en": "Let's eat more vegetables.", "mn": "'Yeah, sigh' when kids are told to eat vegetables."},
    {"deck_slug": "n5-food-dining", "kanji": "卵", "kana": "たまご", "romaji": "tamago", "meaning": "egg", "jlpt": "N5", "pos": "noun", "ex_ja": "朝食に卵を食べます。", "ex_en": "I eat an egg for breakfast.", "mn": "Tamagotchi was an egg-shaped digital pet!"},
    {"deck_slug": "n5-food-dining", "kanji": "美味しい", "kana": "おいしい", "romaji": "oishii", "meaning": "delicious; tasty", "jlpt": "N5", "pos": "i-adjective", "ex_ja": "このラーメンはとても美味しいです。", "ex_en": "This ramen is very delicious.", "mn": "Oh she (oishii) cooked delicious food!"},

    # --- DECK: n5-travel-transit ---
    {"deck_slug": "n5-travel-transit", "kanji": "駅", "kana": "えき", "romaji": "eki", "meaning": "train station", "jlpt": "N5", "pos": "noun", "ex_ja": "駅の前で会いましょう。", "ex_en": "Let's meet in front of the station.", "mn": "Echoing footsteps in the train station (eki)."},
    {"deck_slug": "n5-travel-transit", "kanji": "電車", "kana": "でんしゃ", "romaji": "densha", "meaning": "electric train", "jlpt": "N5", "pos": "noun", "ex_ja": "電車で会社へ行きます。", "ex_en": "I go to work by train.", "mn": "Den (electricity) + sha (vehicle) = electric train."},
    {"deck_slug": "n5-travel-transit", "kanji": "車", "kana": "くるま", "romaji": "kuruma", "meaning": "car; automobile", "jlpt": "N5", "pos": "noun", "ex_ja": "新しい車を買いました。", "ex_en": "I bought a new car.", "mn": "Cruising in my car (kuruma)."},
    {"deck_slug": "n5-travel-transit", "kanji": "飛行機", "kana": "ひこうき", "romaji": "hikouki", "meaning": "airplane", "jlpt": "N5", "pos": "noun", "ex_ja": "飛行機で東京へ行きます。", "ex_en": "I will go to Tokyo by airplane.", "mn": "Hi-flying machine (hikouki)."},
    {"deck_slug": "n5-travel-transit", "kanji": "道", "kana": "みち", "romaji": "michi", "meaning": "road; street; path", "jlpt": "N5", "pos": "noun", "ex_ja": "この道を真っ直ぐ行ってください。", "ex_en": "Please go straight along this road.", "mn": "Michi leads to the destination."},
    {"deck_slug": "n5-travel-transit", "kanji": "右", "kana": "みぎ", "romaji": "migi", "meaning": "right (direction)", "jlpt": "N5", "pos": "noun", "ex_ja": "次の角を右に曲がります。", "ex_en": "Turn right at the next corner.", "mn": "My right hand has MIGHT (migi)."},
    {"deck_slug": "n5-travel-transit", "kanji": "左", "kana": "ひだり", "romaji": "hidari", "meaning": "left (direction)", "jlpt": "N5", "pos": "noun", "ex_ja": "左側に銀行があります。", "ex_en": "There is a bank on the left side.", "mn": "He darted (hidari) to the left."},

    # --- DECK: n5-people-family ---
    {"deck_slug": "n5-people-family", "kanji": "友達", "kana": "ともだち", "romaji": "tomodachi", "meaning": "friend", "jlpt": "N5", "pos": "noun", "ex_ja": "週末に友達と映画を見ました。", "ex_en": "I watched a movie with my friend over the weekend.", "mn": "Tomo (companion) + dachi (plural) = friendship circle."},
    {"deck_slug": "n5-people-family", "kanji": "先生", "kana": "せんせい", "romaji": "sensei", "meaning": "teacher; doctor", "jlpt": "N5", "pos": "noun", "ex_ja": "先生、質問があります。", "ex_en": "Teacher, I have a question.", "mn": "Sen (before) + sei (born) = born before you, a master."},
    {"deck_slug": "n5-people-family", "kanji": "学生", "kana": "がくせい", "romaji": "gakusei", "meaning": "student", "jlpt": "N5", "pos": "noun", "ex_ja": "彼は大学の学生です。", "ex_en": "He is a university student.", "mn": "Gaku (study) + sei (life) = living to study."},
    {"deck_slug": "n5-people-family", "kanji": "父", "kana": "ちち", "romaji": "chichi", "meaning": "father (my father)", "jlpt": "N5", "pos": "noun", "ex_ja": "父は毎朝ジョギングをします。", "ex_en": "My father jogs every morning.", "mn": "Chi-chi sounds like cheerful dad."},
    {"deck_slug": "n5-people-family", "kanji": "母", "kana": "はは", "romaji": "haha", "meaning": "mother (my mother)", "jlpt": "N5", "pos": "noun", "ex_ja": "母の手料理は一番です。", "ex_en": "My mother's home cooking is the best.", "mn": "Haha laughing cheerfully with mom."},

    # --- DECK: n5-action-verbs ---
    {"deck_slug": "n5-action-verbs", "kanji": "食べる", "kana": "たべる", "romaji": "taberu", "meaning": "to eat", "jlpt": "N5", "pos": "verb", "ex_ja": "一緒に昼ご飯を食べませんか。", "ex_en": "Won't you eat lunch together with me?", "mn": "Sit at the TABLE (taberu) to eat."},
    {"deck_slug": "n5-action-verbs", "kanji": "飲む", "kana": "のむ", "romaji": "nomu", "meaning": "to drink", "jlpt": "N5", "pos": "verb", "ex_ja": "朝にコーヒーを飲みます。", "ex_en": "I drink coffee in the morning.", "mn": "No more (nomu) thirst when you drink."},
    {"deck_slug": "n5-action-verbs", "kanji": "行く", "kana": "いく", "romaji": "iku", "meaning": "to go", "jlpt": "N5", "pos": "verb", "ex_ja": "明日、京都へ行きます。", "ex_en": "I am going to Kyoto tomorrow.", "mn": "Eek-o! Time to go!"},
    {"deck_slug": "n5-action-verbs", "kanji": "来る", "kana": "くる", "romaji": "kuru", "meaning": "to come", "jlpt": "N5", "pos": "verb", "ex_ja": "友達が家に遊びに来ました。", "ex_en": "My friend came to visit my house.", "mn": "Cool (kuru) guests come to visit."},
    {"deck_slug": "n5-action-verbs", "kanji": "見る", "kana": "みる", "romaji": "miru", "meaning": "to see; to watch; to look", "jlpt": "N5", "pos": "verb", "ex_ja": "毎晩ニュースを見ます。", "ex_en": "I watch the news every evening.", "mn": "Look into the MIRR-or (miru)."},
    {"deck_slug": "n5-action-verbs", "kanji": "聞く", "kana": "きく", "romaji": "kiku", "meaning": "to hear; to listen; to ask", "jlpt": "N5", "pos": "verb", "ex_ja": "日本の音楽をよく聞きます。", "ex_en": "I often listen to Japanese music.", "mn": "Key clues are heard when you listen (kiku)."},
    {"deck_slug": "n5-action-verbs", "kanji": "話す", "kana": "はなす", "romaji": "hanasu", "meaning": "to speak; to talk", "jlpt": "N5", "pos": "verb", "ex_ja": "日本語で話しましょう。", "ex_en": "Let's speak in Japanese.", "mn": "Hanasu: Words flow like blossoms (hana)."},
    {"deck_slug": "n5-action-verbs", "kanji": "買う", "kana": "かう", "romaji": "kau", "meaning": "to buy; to purchase", "jlpt": "N5", "pos": "verb", "ex_ja": "スーパーでパンを買いました。", "ex_en": "I bought bread at the supermarket.", "mn": "Cow (kau): you buy milk from a cow."},

    # --- DECK: n5-adjectives ---
    {"deck_slug": "n5-adjectives", "kanji": "大きい", "kana": "おおきい", "romaji": "ookii", "meaning": "big; large", "jlpt": "N5", "pos": "i-adjective", "ex_ja": "この犬はとても大きいです。", "ex_en": "This dog is very big.", "mn": "Oh-key! That is gigantic (ookii)."},
    {"deck_slug": "n5-adjectives", "kanji": "小さい", "kana": "ちいさい", "romaji": "chiisai", "meaning": "small; little", "jlpt": "N5", "pos": "i-adjective", "ex_ja": "小さい財布を持っています。", "ex_en": "I have a small wallet.", "mn": "A teeny piece of cheese-eye (chiisai)."},
    {"deck_slug": "n5-adjectives", "kanji": "新しい", "kana": "あたらしい", "romaji": "atarashii", "meaning": "new; fresh", "jlpt": "N5", "pos": "i-adjective", "ex_ja": "新しい靴を履きました。", "ex_en": "I wore new shoes.", "mn": "A brand new auto (atarashii)."},
    {"deck_slug": "n5-adjectives", "kanji": "高い", "kana": "たかい", "romaji": "takai", "meaning": "expensive; tall; high", "jlpt": "N5", "pos": "i-adjective", "ex_ja": "富士山はとても高い山です。", "ex_en": "Mt. Fuji is a very high mountain.", "mn": "Sky-high tower or expensive tie (takai)."},
    {"deck_slug": "n5-adjectives", "kanji": "静か", "kana": "しずか", "romaji": "shizuka", "meaning": "quiet; peaceful", "jlpt": "N5", "pos": "na-adjective", "ex_ja": "図書館はいつも静かです。", "ex_en": "The library is always quiet.", "mn": "Shhh! (shizuka) Be quiet in the library."},

    # --- DECK: n5-home-objects ---
    {"deck_slug": "n5-home-objects", "kanji": "本", "kana": "ほん", "romaji": "hon", "meaning": "book", "jlpt": "N5", "pos": "noun", "ex_ja": "図書館で本を借りました。", "ex_en": "I borrowed a book at the library.", "mn": "Hon-orable books teach wisdom."},
    {"deck_slug": "n5-home-objects", "kanji": "机", "kana": "つくえ", "romaji": "tsukue", "meaning": "desk", "jlpt": "N5", "pos": "noun", "ex_ja": "机の上に辞書があります。", "ex_en": "There is a dictionary on the desk.", "mn": "Tsukue: It took away desk clutter."},
    {"deck_slug": "n5-home-objects", "kanji": "椅子", "kana": "いす", "romaji": "isu", "meaning": "chair", "jlpt": "N5", "pos": "noun", "ex_ja": "どうぞ椅子に座ってください。", "ex_en": "Please sit on the chair.", "mn": "Is-u sitting on the chair?"},
    {"deck_slug": "n5-home-objects", "kanji": "鍵", "kana": "かぎ", "romaji": "kagi", "meaning": "key", "jlpt": "N5", "pos": "noun", "ex_ja": "部屋の鍵を忘れました。", "ex_en": "I forgot my room key.", "mn": "Locked in a cage (kagi) without a key."},

    # --- DECK: n4-work-tech ---
    {"deck_slug": "n4-work-tech", "kanji": "会社", "kana": "かいしゃ", "romaji": "kaisha", "meaning": "company; corporation", "jlpt": "N4", "pos": "noun", "ex_ja": "彼はIT会社に勤めています。", "ex_en": "He works at an IT company.", "mn": "Kai (meet) + sha (shrine/group) = corporate workplace."},
    {"deck_slug": "n4-work-tech", "kanji": "会議", "kana": "かいぎ", "romaji": "kaigi", "meaning": "meeting; conference", "jlpt": "N4", "pos": "noun", "ex_ja": "午後から重要な会議があります。", "ex_en": "There is an important meeting in the afternoon.", "mn": "Kai (meet) + gi (discuss) = conference."},
    {"deck_slug": "n4-work-tech", "kanji": "資料", "kana": "しりょう", "romaji": "shiryou", "meaning": "materials; documents; data", "jlpt": "N4", "pos": "noun", "ex_ja": "会議の資料を印刷しました。", "ex_en": "I printed the meeting materials.", "mn": "She read your (shiryou) handouts."},
    {"deck_slug": "n4-work-tech", "kanji": "準備", "kana": "じゅんび", "romaji": "junbi", "meaning": "preparation; setup", "jlpt": "N4", "pos": "noun/verb", "ex_ja": "プレゼンの準備ができました。", "ex_en": "The presentation prep is complete.", "mn": "June be (junbi) ready for summer."},
    {"deck_slug": "n4-work-tech", "kanji": "連絡", "kana": "れんらく", "romaji": "renraku", "meaning": "contact; communication", "jlpt": "N4", "pos": "noun/verb", "ex_ja": "後でメールで連絡します。", "ex_en": "I will get in touch by email later.", "mn": "Ren ran to reach (renraku) contact."},

    # --- DECK: n4-emotions-sensations ---
    {"deck_slug": "n4-emotions-sensations", "kanji": "嬉しい", "kana": "うれしい", "romaji": "ureshii", "meaning": "happy; glad; joyful", "jlpt": "N4", "pos": "i-adjective", "ex_ja": "試験に合格してとても嬉しいです。", "ex_en": "I am so happy that I passed the exam.", "mn": "You're shiny (ureshii) and radiant with joy!"},
    {"deck_slug": "n4-emotions-sensations", "kanji": "悲しい", "kana": "かなしい", "romaji": "kanashii", "meaning": "sad; sorrowful", "jlpt": "N4", "pos": "i-adjective", "ex_ja": "悲しい映画を見て泣きました。", "ex_en": "I cried watching a sad movie.", "mn": "Cannot see (kanashii) through sad tears."},
    {"deck_slug": "n4-emotions-sensations", "kanji": "心配", "kana": "しんぱい", "romaji": "shinpai", "meaning": "worry; concern; anxiety", "jlpt": "N4", "pos": "noun/verb", "ex_ja": "何も心配しないでください。", "ex_en": "Please do not worry about anything.", "mn": "Shin (heart) + pai (distribute) = your heart is torn with worry."},
    {"deck_slug": "n4-emotions-sensations", "kanji": "安心", "kana": "あんしん", "romaji": "anshin", "meaning": "relief; peace of mind", "jlpt": "N4", "pos": "noun/verb", "ex_ja": "無事について安心しました。", "ex_en": "I was relieved to arrive safely.", "mn": "An (peace) + shin (heart) = tranquil mind."},

    # --- DECK: n4-nature-weather ---
    {"deck_slug": "n4-nature-weather", "kanji": "雨", "kana": "あめ", "romaji": "ame", "meaning": "rain", "jlpt": "N4", "pos": "noun", "ex_ja": "午後から強い雨が降る予報です。", "ex_en": "Heavy rain is forecast from afternoon.", "mn": "Rain on my umbrella: 'Ah, meh' (ame)."},
    {"deck_slug": "n4-nature-weather", "kanji": "雪", "kana": "ゆき", "romaji": "yuki", "meaning": "snow", "jlpt": "N4", "pos": "noun", "ex_ja": "冬にはたくさんの雪が降ります。", "ex_en": "A lot of snow falls in winter.", "mn": "Yuki loved playing in pure white snow."},
    {"deck_slug": "n4-nature-weather", "kanji": "台風", "kana": "たいふう", "romaji": "taifuu", "meaning": "typhoon; tropical cyclone", "jlpt": "N4", "pos": "noun", "ex_ja": "台風が近づいています。", "ex_en": "A typhoon is approaching.", "mn": "Tai (big) + fuu (wind) = typhoon."},
    {"deck_slug": "n4-nature-weather", "kanji": "季節", "kana": "きせつ", "romaji": "kisetsu", "meaning": "season (of the year)", "jlpt": "N4", "pos": "noun", "ex_ja": "日本には美しい四季（きせつ）があります。", "ex_en": "Japan has beautiful four seasons.", "mn": "Key seasons (kisetsu) bring cherry blossoms."},

    # --- DECK: n4-advanced-verbs ---
    {"deck_slug": "n4-advanced-verbs", "kanji": "始める", "kana": "はじめる", "romaji": "hajimeru", "meaning": "to start; to begin (transitive)", "jlpt": "N4", "pos": "verb", "ex_ja": "会議を始めましょう。", "ex_en": "Let's begin the meeting.", "mn": "Hajime-mashite: nice to meet you as we start our friendship."},
    {"deck_slug": "n4-advanced-verbs", "kanji": "終わる", "kana": "おわる", "romaji": "owaru", "meaning": "to end; to finish", "jlpt": "N4", "pos": "verb", "ex_ja": "仕事が５時に終わりました。", "ex_en": "Work finished at 5 o'clock.", "mn": "Over (owaru) at last!"},
    {"deck_slug": "n4-advanced-verbs", "kanji": "覚える", "kana": "おぼえる", "romaji": "oboeru", "meaning": "to remember; to memorize", "jlpt": "N4", "pos": "verb", "ex_ja": "新しい単語を覚えました。", "ex_en": "I memorized new vocabulary words.", "mn": "Oh boy (oboeru), I finally memorized that kanji!"},
    {"deck_slug": "n4-advanced-verbs", "kanji": "忘れる", "kana": "わすれる", "romaji": "wasureru", "meaning": "to forget; to leave behind", "jlpt": "N4", "pos": "verb", "ex_ja": "傘を電車に忘れました。", "ex_en": "I forgot my umbrella on the train.", "mn": "Was it really there? I forgot (wasureru)."},
    {"deck_slug": "n4-advanced-verbs", "kanji": "手伝う", "kana": "てつだう", "romaji": "tetsudau", "meaning": "to help; to assist", "jlpt": "N4", "pos": "verb", "ex_ja": "掃除を手伝ってください。", "ex_en": "Please help me with cleaning.", "mn": "Te (hand) + tsudau = lend a helping hand."},

    # --- DECK: n4-society-culture ---
    {"deck_slug": "n4-society-culture", "kanji": "祭り", "kana": "まつり", "romaji": "matsuri", "meaning": "festival; celebration", "jlpt": "N4", "pos": "noun", "ex_ja": "夏休みに地元の祭りへ行きました。", "ex_en": "I went to the local festival during summer break.", "mn": "Matsuri: Lanterns and food stalls under the stars."},
    {"deck_slug": "n4-society-culture", "kanji": "規則", "kana": "きそく", "romaji": "kisoku", "meaning": "rules; regulations", "jlpt": "N4", "pos": "noun", "ex_ja": "寮の規則を守らなければなりません。", "ex_en": "You must obey the dormitory rules.", "mn": "Key socket rules: keep electrical cords tidy."},
    {"deck_slug": "n4-society-culture", "kanji": "習慣", "kana": "しゅうかん", "romaji": "shuukan", "meaning": "custom; habit", "jlpt": "N4", "pos": "noun", "ex_ja": "日本の習慣に慣れました。", "ex_en": "I got used to Japanese customs.", "mn": "Shuu (practice) + kan (habit) = custom."},

    # --- DECK: n4-connectors-adverbs ---
    {"deck_slug": "n4-connectors-adverbs", "kanji": "だから", "kana": "だから", "romaji": "dakara", "meaning": "so; therefore", "jlpt": "N4", "pos": "conjunction", "ex_ja": "雨が降っています。だから傘を持っていきます。", "ex_en": "It is raining. Therefore I will take an umbrella.", "mn": "Da-car is broken, DAKARA I took the train."},
    {"deck_slug": "n4-connectors-adverbs", "kanji": "しかし", "kana": "しかし", "romaji": "shikashi", "meaning": "however; but", "jlpt": "N4", "pos": "conjunction", "ex_ja": "値段は高いです。しかし品質は良いです。", "ex_en": "The price is high. However, the quality is good.", "mn": "She can see (shikashi) the flaw, however it's okay."},
    {"deck_slug": "n4-connectors-adverbs", "kanji": "特に", "kana": "とくに", "romaji": "tokuni", "meaning": "especially; particularly", "jlpt": "N4", "pos": "adverb", "ex_ja": "日本料理、特に寿司が好きです。", "ex_en": "I like Japanese cuisine, especially sushi.", "mn": "Toku (special) + ni = in a special way."},
    {"deck_slug": "n4-connectors-adverbs", "kanji": "必ず", "kana": "かならず", "romaji": "kanarazu", "meaning": "certainly; without fail", "jlpt": "N4", "pos": "adverb", "ex_ja": "明日、必ず宿題を提出してください。", "ex_en": "Please submit your homework tomorrow without fail.", "mn": "Can a rose (kanarazu) bloom? Certainly without fail!"}
]


def seed_database():
    """Initializes tables, seeds themed decks, and populates N5/N4 vocabulary."""
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # 1. Seed Decks
        with open(THEMED_DECKS_FILE, "r", encoding="utf-8") as f:
            decks_data = json.load(f)

        deck_id_map = {}
        for d in decks_data:
            existing = db.query(Deck).filter_by(slug=d["slug"]).first()
            if not existing:
                deck = Deck(
                    slug=d["slug"],
                    name=d["name"],
                    name_ja=d["name_ja"],
                    description=d.get("description"),
                    icon=d.get("icon", "📖"),
                    color=d.get("color", "#E0F2FE"),
                    jlpt_level=d.get("jlpt_level", "N5"),
                    sort_order=d.get("sort_order", 0)
                )
                db.add(deck)
                db.flush()
                deck_id_map[d["slug"]] = deck.id
            else:
                deck_id_map[d["slug"]] = existing.id

        # 2. Ensure demo user exists
        from app.auth import ensure_demo_user
        demo_user = ensure_demo_user(db)

        # 3. Seed Vocabulary Words
        inserted_words = 0
        for item in RAW_VOCABULARY:
            word = db.query(Word).filter(
                Word.kana == item["kana"],
                Word.meaning == item["meaning"]
            ).first()

            deck_id = deck_id_map.get(item["deck_slug"])

            if not word:
                word = Word(
                    deck_id=deck_id,
                    lesson_number=1,
                    book_title=f"JLPT {item['jlpt']} Vocabulary",
                    kanji=item.get("kanji"),
                    kana=item["kana"],
                    romaji=item["romaji"],
                    meaning=item["meaning"],
                    jlpt_level=item["jlpt"],
                    part_of_speech=item["pos"],
                    example_ja=item.get("ex_ja"),
                    example_en=item.get("ex_en"),
                    mnemonic=item.get("mn")
                )
                db.add(word)
                db.flush()
                inserted_words += 1
            else:
                # Update deck_id and mnemonic if missing
                if word.deck_id != deck_id or not word.mnemonic:
                    word.deck_id = deck_id
                    word.mnemonic = item.get("mn")
                    db.flush()

            # Ensure demo user has progress record initialized
            existing_prog = db.query(UserProgress).filter_by(
                user_id=demo_user.id,
                word_id=word.id
            ).first()

            if not existing_prog:
                prog = UserProgress(
                    user_id=demo_user.id,
                    word_id=word.id,
                    is_in_review=True,  # Put initial words in review queue for demo user
                    star_rating=1,
                    repetitions=0,
                    interval_days=0.0,
                    ease_factor=2.5,
                    streak=0,
                    correct_streak=0,
                    total_attempts=0,
                    correct_attempts=0,
                    next_review_due=datetime.now(timezone.utc)
                )
                db.add(prog)

        db.commit()
        print(f"Seeding completed successfully: {len(deck_id_map)} decks and {inserted_words} vocabulary words created.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
