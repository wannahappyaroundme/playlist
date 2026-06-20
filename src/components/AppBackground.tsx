// Full-screen photo background for the non-player "chrome" screens (Gallery, Editor).
// A dark overlay + top/bottom vignette keep white text and translucent cards readable
// over the bright twilight sky. Fixed + negative z-index so content sits above it.
export default function AppBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}background.jpg)` }}
      />
      {/* readability: darken overall + slightly stronger top/bottom for header & edges */}
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/65" />
    </div>
  );
}
