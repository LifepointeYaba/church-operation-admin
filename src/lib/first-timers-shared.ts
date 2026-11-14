/** First-timer form constants and helpers. Safe to import from client components (no server code). */

export const HOW_HEARD = ["A friend or family member", "Social media", "Walked past", "Online search", "An event or flyer", "Other"]
export const CHURCH_HOME = ["Yes", "No, just visiting", "Not sure yet"]
export const INTERESTS = ["Join Lifegroup", "Join Community Channel", "Speak with Pastor", "Speak with Counsellor", "Speak with Leader"]
export const GROWTH = ["Prayer", "Bible Study", "Evangelism", "Leadership", "Worship", "Serving"]

/** Public-domain (KJV) verses shown after someone submits the form. */
export const BIBLE_VERSES: { text: string; ref: string }[] = [
  { text: "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.", ref: "Jeremiah 29:11" },
  { text: "The LORD bless thee, and keep thee: the LORD make his face shine upon thee, and be gracious unto thee.", ref: "Numbers 6:24–25" },
  { text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest.", ref: "Matthew 11:28" },
  { text: "Trust in the LORD with all thine heart; and lean not unto thine own understanding.", ref: "Proverbs 3:5" },
  { text: "I can do all things through Christ which strengtheneth me.", ref: "Philippians 4:13" },
  { text: "The LORD is my shepherd; I shall not want.", ref: "Psalm 23:1" },
  { text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.", ref: "John 3:16" },
  { text: "Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.", ref: "Joshua 1:9" },
  { text: "And we know that all things work together for good to them that love God.", ref: "Romans 8:28" },
  { text: "They that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles.", ref: "Isaiah 40:31" },
  { text: "The LORD is nigh unto all them that call upon him, to all that call upon him in truth.", ref: "Psalm 145:18" },
  { text: "Behold, I stand at the door, and knock: if any man hear my voice, and open the door, I will come in to him.", ref: "Revelation 3:20" },
  { text: "This is the day which the LORD hath made; we will rejoice and be glad in it.", ref: "Psalm 118:24" },
  { text: "Now the God of hope fill you with all joy and peace in believing.", ref: "Romans 15:13" },
  { text: "Draw nigh to God, and he will draw nigh to you.", ref: "James 4:8" },
  { text: "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you.", ref: "John 14:27" },
  { text: "The steadfast love of the LORD never ceaseth; his mercies are new every morning: great is thy faithfulness.", ref: "Lamentations 3:22–23" },
  { text: "Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new.", ref: "2 Corinthians 5:17" },
]

export const DEFAULT_WHATSAPP_MESSAGE =
  "Hi {firstName}, thank you so much for worshipping with us at LifePointe on {sunday}! We're glad you came. Is there anything we can pray with you about this week? We'd love to see you again next Sunday."

/** Fill {firstName} / {sunday} in the WhatsApp template. */
export function fillTemplate(template: string, vars: { firstName: string; sunday: string }) {
  return template.replace(/\{firstName\}/g, vars.firstName).replace(/\{sunday\}/g, vars.sunday)
}

/** wa.me link for a stored +234 number with a pre-filled message; null when the number can't be used. */
export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "")
  if (digits.length < 10) return null
  const intl = digits.startsWith("0") ? `234${digits.slice(1)}` : digits
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`
}
