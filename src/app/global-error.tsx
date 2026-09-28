"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main>
          <h1>3Template could not load</h1>
          <p>Please try again.</p>
          <button onClick={reset}>Try again</button>
        </main>
      </body>
    </html>
  );
}
