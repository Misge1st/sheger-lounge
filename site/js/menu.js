var SHEGER_MENU = {
  info: {
    address: "አድራሻ: ካሳንቺስ ዑራኤል ቤ/ክ ፊት ለፊት ስፖርት ፓርክ አጠገብ",
    maps: "https://maps.app.goo.gl/qZxyPVoW5e4ZdFVg8?g_st=ic",
    phones: ["251 911 59 70 29", "0909 05 10 24"],
    tiktok: "@sheger_kurt",
    deliveryFee: "100"
  },
  home: { media: [] },
  food: [
    { category: "Meats", id: "kurt", name: "Kurt", am: "ቁርጥ", image: "photos/kurt.jpg", available: true, sizes: [{ name: "1 kg", price: "3,950" }, { name: "1/2 kg", price: "1,950" }] },
    { category: "Meats", id: "gas-light", name: "Gas Light", am: "ጋዝ ላይት", image: "photos/gas-light.jpg", available: true, sizes: [{ name: "1 kg", price: "3,950" }, { name: "1/2 kg", price: "1,950" }, { name: "1/4 kg", price: "950" }] },
    { category: "Meats", id: "shekla", name: "Shekla", am: "ሸክላ", image: "photos/shekla.jpg", available: true, sizes: [{ name: "1 kg", price: "3,950" }, { name: "1/2 kg", price: "1,950" }, { name: "1/4 kg", price: "1,100" }] },
    { category: "Meats", id: "senber", name: "Senber", am: "ሰንበር", image: "photos/senber.jpg", available: true, sizes: [{ name: "1 kg", price: "1,500" }, { name: "1/2 kg", price: "750" }, { name: "1/4 kg", price: "375" }] },
    { category: "Meats", id: "emis-emis", name: "Emis Emis", am: "እምስ እምስ", image: "photos/emis-emis.jpg", available: true, sizes: [{ name: "1 kg", price: "4,300" }, { name: "1/2 kg", price: "2,150" }] },

    { category: "Dishes", id: "ariza", name: "Ariza", am: "አርዛ", image: "photos/ariza.jpg", price: "1,150", share: true, available: true },
    { category: "Dishes", id: "zumbara", name: "Zumbara", am: "ዙምብራ", image: "photos/ariza.jpg", price: "1,050", share: true, available: true },
    { category: "Dishes", id: "normal-kitfo", name: "Normal Kitfo", am: "ኖርማል ክትፎ", image: "photos/normal-kitfo.jpg", price: "1,650", available: true },
    { category: "Dishes", id: "special-kitfo", name: "Special Kitfo", am: "ስፔሻል ክትፎ", image: "photos/special-kitfo.jpg", price: "2,675", available: true },
    { category: "Dishes", id: "scrambled-egg", name: "Scrambled Egg", am: "እንቁላል ፍርፍር", image: "photos/scrambled-egg.jpg", price: "360", available: true },
    { category: "Dishes", id: "dulet", name: "Dulet", am: "ዱለት", image: "photos/dulet.jpg", price: "510", available: true },
    { category: "Dishes", id: "tibs-firfir", name: "Tibs Firfir", am: "ጥብስ ፍርፍር", image: "photos/tibs-firfir.jpg", price: "480", available: true },
    { category: "Dishes", id: "quanta-firfir", name: "Quanta Firfir", am: "ቋንጣ ፍርፍር", image: "photos/quanta-firfir.jpg", price: "500", available: true },
    { category: "Dishes", id: "musina", name: "Musina", am: "ሙስና", image: "photos/musina.jpg", price: "1,200", available: true },
    { category: "Dishes", id: "special-yetsom", name: "Special Yetsom Firfir", am: "ስፔሻል የፆም ፍርፍር", image: "photos/special-yetsom.jpg", price: "500", available: true },
    { category: "Dishes", id: "combo", name: "Sheger Special Combo", am: "ሸገር ስፔሻል ኮምቦ", image: "photos/combo.jpg", price: "5,500", feature: true, available: true },
    { category: "Dishes", id: "yefisik", name: "Yefisik Agelgil", am: "የፍስክ አገልግል", image: "photos/yefisik.jpg", price: "3,600", available: true },

    { category: "Fasting", id: "yetsom-combo", name: "Yetsom Combo", am: "የፆም ኮምቦ", image: "photos/yetsom-combo.jpg", price: "850", available: true },
    { category: "Fasting", id: "atikilt", name: "Atikilt Firfir", am: "አትክልት ፍርፍር", image: "photos/atikilt.jpg", price: "350", available: true },
    { category: "Fasting", id: "shiro", name: "Shiro Feses", am: "ሽሮ ፈሰስ", image: "photos/shiro.jpg", price: "300", available: true },
    { category: "Fasting", id: "gomen-tibs", name: "Gomen Tibs", am: "ጎመን ጥብስ", image: "photos/gomen-tibs.jpg", price: "350", available: true },
    { category: "Fasting", id: "tegabino", name: "Tegabino", am: "ተጋቢኖ", image: "photos/tegabino.jpg", price: "350", available: true },
    { category: "Fasting", id: "beyeaynet", name: "Beyeaynet", am: "በየአይነት", image: "photos/beyeaynet.jpg", price: "350", available: true },
    { category: "Fasting", id: "gomen-kitfo", name: "Gomen Kitfo", am: "ጎመን ክትፎ", image: "photos/gomen-kitfo.jpg", price: "400", available: true },
    { category: "Fasting", id: "spring-roll", name: "Spring Roll", am: "ስፕሪንግ ሮል", image: "photos/spring-roll.jpg", price: "350", available: true }
  ],
  drinks: [
    { category: "Spirits", name: "Black Label", sizes: [{ name: "1/2 Bottle", price: "8,549" }, { name: "Bottle", price: "16,000" }, { name: "Double", price: "1,030" }, { name: "Shot", price: "515" }] },
    { category: "Spirits", name: "Gordon's", sizes: [{ name: "Bottle", price: "11,330" }, { name: "1/2 Bottle", price: "5,871" }, { name: "Double", price: "824" }, { name: "Shot", price: "315" }] },
    { category: "Spirits", name: "Jägermeister", sizes: [{ name: "Bottle", price: "14,420" }, { name: "1/2 Bottle", price: "7,000" }, { name: "Shot", price: "515" }, { name: "Double", price: "1,000" }] },
    { category: "Spirits", name: "Red Label", sizes: [{ name: "Double", price: "726" }, { name: "Shot", price: "400" }] },
    { category: "Spirits", name: "Amarula", sizes: [{ name: "Bottle", price: "9,476" }, { name: "Double", price: "800" }, { name: "Shot", price: "412" }] },
    { category: "Spirits", name: "Gold Label", sizes: [{ name: "Bottle", price: "25,750" }] },
    { category: "Spirits", name: "Acacia", sizes: [{ name: "White", price: "2,500" }] },
    { category: "Spirits", name: "Gebeta", rows: [{ name: "Gebeta", price: "2,060" }, { name: "Axumite", price: "1,100" }, { name: "Kamila", price: "2,060" }, { name: "Red Bull", price: "875" }] },
    { category: "Spirits", name: "Sambuca", sizes: [{ name: "Shot", price: "412" }] },
    { category: "Spirits", name: "Camino", sizes: [{ name: "Bottle", price: "10,506" }, { name: "Shot", price: "566" }] },
    { category: "Spirits", name: "Absolut", sizes: [{ name: "Bottle", price: "7,700" }] },
    { category: "Soft drinks", name: "Soft Drinks", rows: [{ name: "Soft drink", price: "80" }, { name: "Malt", price: "125" }, { name: "Normal beer", price: "135" }, { name: "Special beer", price: "155" }, { name: "1 Lt water", price: "80" }, { name: "1/2 Lt water", price: "60" }, { name: "Awash Tekeshimo", price: "1,100" }] }
  ]
};
