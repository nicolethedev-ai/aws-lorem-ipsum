"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Head from "next/head";

type Message = {
  role: "bot" | "user";
  text: string;
};

const chips = [
  "Lorem ipsum dolor sit amet consectetur adipiscing elit.",
  "Lorem ipsum dolor sit amet consectetur adipiscing elit.",
  "Lorem ipsum dolor sit amet consectetur adipiscing elit.",
];

const projects = [
  {
    name: "Lorem Ipsum",
    type: "Lorem Ipsum",
    text: "Lorem ipsum dolor sit amet consectetur adipiscing elit.",
    tags: ["Lorem", "Lorem", "Lorem"],
    url: "#",
  },
  {
    name: "Lorem Ipsum",
    type: "Lorem Ipsum",
    text: "Lorem ipsum dolor sit amet consectetur adipiscing elit.",
    tags: ["Lorem", "Lorem", "Lorem"],
    url: "#",
  },
];

const stacks = ["Lorem", "Ipsum", "Lorem", "Ipsum"]
const email = "test@example.com"

function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="var(--cream)" />
      <circle cx="20" cy="20" r="13" fill="var(--sage)" />
      <circle cx="20" cy="20" r="6" fill="var(--moss)" />
    </svg>
  );
}

function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [usedChips, setUsedChips] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: "Hello. I am virtual assistant. What would you like to know?" },
  ]);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, loading]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setOpen(true);
    setInput("");
    setLoading(true);
    setMessages((items) => [...items, { role: "user", text: trimmed }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      setMessages((items) => [...items, { role: "bot", text: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          answer += line.slice(6);
          setMessages((items) => {
            const next = [...items];
            next[next.length - 1] = { role: "bot", text: answer };
            return next;
          });
        }
      }
    } catch {
      setMessages((items) => [
        ...items,
        { role: "bot", text: "I haven't been able to connect the chatbot yet. You can email at " + email },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(input);
  }

  return (
    <div className="widget">
      <div className={`widget-panel ${open ? "open" : ""}`}>
        <div className="chat-head">
          <div className="chat-avatar"><Mark size={22} /></div>
          <div className="chat-head-text">
            <strong>matcha.assist</strong>
            <span><i className="dot" />Ask about ...</span>
          </div>
          <button className="widget-close" onClick={() => setOpen(false)} aria-label="Close">x</button>
        </div>
        <div className="chat-body" ref={bodyRef}>
          {messages.map((message, index) => (
            <div className={`bubble ${message.role}`} key={`${message.role}-${index}`}>
              {message.text || " "}
            </div>
          ))}
          {loading && (
            <div className="bubble bot typing" aria-label="Answering">
              <span /><span /><span />
            </div>
          )}
        </div>
        <div className="chip-row">
          {chips.map((chip) => {
            const used = usedChips.includes(chip);
            return (
              <button
                className={`chip ${used ? "used" : ""}`}
                disabled={used || loading}
                key={chip}
                onClick={() => {
                  setUsedChips((items) => [...items, chip]);
                  ask(chip);
                }}
              >
                {chip}
              </button>
            );
          })}
        </div>
        <form className="chat-form" onSubmit={submit}>
          <input
            aria-label="Message for the chatbot"
            disabled={loading}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about experience, stack, projects..."
            value={input}
          />
          <button disabled={loading || !input.trim()} type="submit">Send</button>
        </form>
      </div>
      <button
        className="widget-btn"
        onClick={() => setOpen((value) => !value)}
        aria-label="Open matcha.assist"
        aria-expanded={open}
      >
        <Mark />
      </button>
    </div>
  );
}

export default function Home() {  
  return (
    <>
      <Head>
        <title>Lorem ipsum </title>
        <meta
          name="description"
          content="Lorem ipsum dolor sit amet consectetur adipiscing elit."
        />
      </Head>
      <div className="page">
        <header className="nav">
          <div className="brand"><span className="brand-mark" />Lorem</div>
          <nav className="nav-links">
            <a href="#work">Work</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>
        </header>

        <main>
          <section className="hero">
            <div>
              <div className="eyebrow">Lorem</div>
              <h1>Lorem, <em>ipsum</em> dolor sit amet consectetur adipiscing elit.</h1>
              <p className="lead">
                Lorem ipsum dolor sit amet consectetur adipiscing elit.
              </p>
              <div className="cta-row">
                <a className="btn primary" href="#work">See the work</a>
                <a className="btn" href="#contact">Get in touch</a>
                {/*<a className="btn" href="/profile.pdf">Resume PDF</a>*/}
              </div>
            </div>
            <div className="hero-teaser" aria-hidden="true">
              <div className="hero-teaser-icon"><Mark /></div>
              <p><strong>matcha.assist</strong><br />Have a question about me? Click the button in the top-right corner of the screen to ask quickly.</p>
            </div>
          </section>

          <div className="stats">
            <div className="stat"><strong>2+</strong><span>Years in ...</span></div>
            <div className="stat"><strong>AWS</strong><span>...</span></div>
            <div className="stat"><strong>EN / VI</strong><span>Bilingual delivery</span></div>
          </div>

          <section className="section" id="about">
            <div className="section-box">
              <div className="badge">About</div>
              <h2>Lorem ipsum dolor sit amet consectetur adipiscing elit.</h2>
              <p className="section-sub">
                Lorem ipsum dolor sit amet consectetur adipiscing elit.
              </p>
              <div className="grid3">
                <article className="card">
                  <h3>Lorem ipsum dolor sit amet consectetur adipiscing elit.</h3>
                  <p>Lorem ipsum dolor sit amet consectetur adipiscing elit. Sit amet consectetur adipiscing elit quisque faucibus ex. Adipiscing elit quisque faucibus ex sapien vitae pellentesque.</p>
                </article>
                <article className="card">
                  <h3>Lorem ipsum dolor</h3>
                  <p>Lorem ipsum dolor sit amet consectetur adipiscing elit. Sit amet consectetur adipiscing elit quisque faucibus ex. Adipiscing elit quisque faucibus ex sapien vitae pellentesque.</p>
                </article>
                <article className="card">
                  <h3>Lorem ipsum dolor</h3>
                  <p>Lorem ipsum dolor sit amet consectetur adipiscing elit. Sit amet consectetur adipiscing elit quisque faucibus ex. Adipiscing elit quisque faucibus ex sapien vitae pellentesque.</p>
                </article>
              </div>
            </div>
          </section>

          <section className="section" id="work">
            <div className="section-box">
              <div className="badge">Selected Work</div>
              <h2>A few systems I have shipped.</h2>
              <div className="projects">
                {projects.map((project) => (
                  <article className="project" key={project.name}>
                    <div>
                      <h3>
                        <a href={project.url} target="_blank" rel="noreferrer">
                          {project.name}
                        </a>
                      </h3>
                      <p>{project.text}</p>
                      <div className="tag-row">
                        {project.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
                      </div>
                      <a className="project-link" href={project.url} target="_blank" rel="noreferrer">
                        Go to repository
                      </a>
                    </div>
                    <span className="project-type">{project.type}</span>
                  </article>
                ))}
              </div>
              <div className="stack">
                {stacks.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          </section>

          <section className="section" id="contact">
            <div className="section-box">
              <div className="badge">Contact</div>
              <h2>Lorem ipsum dolor sit amet consectetur adipiscing elit?</h2>
              <p className="section-sub">
                Lorem ipsum dolor sit amet consectetur adipiscing elit.
                <br />Email: <a href="mailto:test@example.com">test@example.com</a>
              </p>
            </div>
          </section>
        </main>

        <footer>
          <span>Designed with a matcha palette: cream, taupe, sage, moss.</span>
          <a href="#top">Back to top</a>
        </footer>
      </div>
      <ChatWidget />
    </>
  );
}
