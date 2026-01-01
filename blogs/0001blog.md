# Zookeeper v3: A Fresh Design Refresh

*January 1, 2026*

Today we shipped a complete visual overhaul of Zookeeper, our mobile app for tracking zoo animal sightings. After several iterations that never quite felt right, we finally landed on a design that's warm, approachable, and genuinely delightful to use.

## The Challenge

Our previous attempts at updating the UI kept running into the same problems - the design felt either too sterile or too cluttered. We wanted something that captured the excitement of spotting animals at the zoo while remaining clean and easy to use.

## The Solution: Zookeeper v3

We call this update "The Sweet Spot" - warm and approachable, but grown-up. Think Duolingo's polish meets Airbnb's warmth.

### Design Tokens

The new color palette is earthy and inviting:

- **Forest Green** (#2D5A3D) - Our primary brand color
- **Gold** (#D4A855) - For highlights and progress indicators
- **Terracotta** (#D4654A) - Accent color, including the "oo" in our logo
- **Cream** (#FAF8F4) - Warm background that's easy on the eyes

### Key UI Elements

**Welcome Screen**
The onboarding is simple and focused - just enter your name and start exploring. The logo features "Z**oo**keeper" with the "oo" in terracotta, a subtle nod to the eyes of the animals you'll be spotting.

**Home Dashboard**
- Personalized greeting based on time of day
- Active visit card with progress tracking
- Quick stats (animals spotted, zoos visited, photos taken)
- Recent sightings feed with "NEW" badges for fresh catches

**Floating Navigation**
The bottom nav is a floating pill design with soft shadows - it feels modern without being trendy. Four clear destinations: Home, Spot, Collection, and Profile.

**Camera View**
Gold corner brackets frame the detection area, with a frosted glass indicator showing scan status. Recent sightings appear as thumbnail strips at the bottom.

**Discovery Results**
When you identify an animal, a slide-up card reveals the match with confidence score, category tag, and a "Did you know?" fact card with a gold accent border.

## Technical Notes

The entire frontend uses inline styles matching our design spec exactly - no Tailwind abstractions, just precise pixel values. This ensures the app looks identical to the Figma mockups.

The app remains a mobile-first PWA, pillarboxed to 430px max-width on desktop to maintain the intended experience.

## What's Next

With the visual foundation solid, we're focusing on:
- Richer animal profiles with photos and conservation status
- Social features for sharing sightings
- Offline-first improvements for spotty zoo WiFi

Thanks for following along. Now get out there and spot some animals!

---

*Zookeeper - Track your wildlife adventures*
