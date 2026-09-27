"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section role="alert">
      <h1>Unable to load your workspace</h1>
      <p>
        Please try again. If this continues, contact the person who runs this
        3Template instance.
      </p>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
