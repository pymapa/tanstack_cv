import {
	createChatClientOptions,
	fetchServerSentEvents,
	useChat,
} from "@tanstack/ai-react";
import { Loader2, MessageCircle, Send, Square, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Streamdown } from "streamdown";

import { cn } from "#/lib/utils";

const chatOptions = createChatClientOptions({
	connection: fetchServerSentEvents("/api/cv-chat"),
});

const TOOL_LABELS: Record<string, string> = {
	searchPeople: "Searching CVs",
	getCv: "Reading a CV",
};

/** CV assistant chat, floating in the bottom-right corner of every page. */
export default function CvChatWidget() {
	const [open, setOpen] = useState(false);
	const panelId = useId();

	return (
		<div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3">
			{/* Hidden rather than unmounted, so the conversation survives closing. */}
			<ChatPanel id={panelId} open={open} onClose={() => setOpen(false)} />
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
				aria-controls={panelId}
				aria-label={open ? "Close CV assistant" : "Open CV assistant"}
				className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg transition hover:bg-neutral-700"
			>
				{open ? (
					<X aria-hidden className="h-6 w-6" />
				) : (
					<MessageCircle aria-hidden className="h-6 w-6" />
				)}
			</button>
		</div>
	);
}

function ChatPanel({
	id,
	open,
	onClose,
}: {
	id: string;
	open: boolean;
	onClose: () => void;
}) {
	const [input, setInput] = useState("");
	const { messages, sendMessage, isLoading, stop, error } =
		useChat(chatOptions);
	const endRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (open) inputRef.current?.focus();
	}, [open]);

	// Keep the newest message in view as it streams in.
	useEffect(() => {
		if (messages.length) endRef.current?.scrollIntoView({ block: "end" });
	}, [messages]);

	const submit = (e: React.FormEvent) => {
		e.preventDefault();
		const text = input.trim();
		if (!text || isLoading) return;
		sendMessage(text);
		setInput("");
	};

	return (
		<section
			id={id}
			hidden={!open}
			aria-label="CV assistant"
			onKeyDown={(e) => {
				if (e.key === "Escape") onClose();
			}}
			className="flex h-[32rem] [&[hidden]]:hidden max-h-[calc(100vh-7rem)] w-[26rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-black shadow-2xl"
		>
			<header className="border-b border-neutral-200 px-4 py-3">
				<h2 className="m-0 text-base font-semibold text-black">CV assistant</h2>
			</header>

			<div
				aria-live="polite"
				className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
			>
				{messages.length === 0 && (
					<p className="m-0 text-sm text-neutral-700">
						Ask who fits a client need, for example "Who has led agile teams in
						insurance?"
					</p>
				)}
				{messages.map((message) => (
					<article
						key={message.id}
						aria-label={message.role === "user" ? "You" : "Assistant"}
						className={cn(
							"max-w-[85%] rounded-xl p-3 text-sm",
							message.role === "user"
								? "self-end bg-neutral-100"
								: "self-start",
						)}
					>
						{message.parts.map((part, index) => {
							if (part.type === "text" && part.content) {
								return (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: parts have no stable id
										key={index}
										className="prose prose-sm max-w-none"
									>
										<Streamdown>{part.content}</Streamdown>
									</div>
								);
							}
							if (part.type === "tool-call") {
								return (
									<p key={part.id} className="m-0 italic text-neutral-700">
										{TOOL_LABELS[part.name] ?? part.name}…
									</p>
								);
							}
							return null;
						})}
					</article>
				))}
				{isLoading && (
					<p className="m-0 flex items-center gap-2 text-sm text-neutral-700">
						<Loader2 aria-hidden className="h-4 w-4 animate-spin" />
						Thinking…
					</p>
				)}
				{error && (
					<p role="alert" className="m-0 text-sm text-red-700">
						Something went wrong: {error.message}
					</p>
				)}
				<div ref={endRef} />
			</div>

			<form
				onSubmit={submit}
				className="flex gap-2 border-t border-neutral-200 p-3"
			>
				<label htmlFor={`${id}-input`} className="sr-only">
					Message
				</label>
				<textarea
					id={`${id}-input`}
					ref={inputRef}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) submit(e);
					}}
					rows={2}
					placeholder="Ask about people, skills or clients…"
					className="flex-1 resize-none rounded-xl border border-neutral-300 bg-white p-2 text-sm text-black placeholder:text-neutral-500"
				/>
				{isLoading ? (
					<button
						type="button"
						onClick={stop}
						aria-label="Stop"
						className="flex w-10 items-center justify-center rounded-xl border border-neutral-300 text-black"
					>
						<Square aria-hidden className="h-4 w-4" />
					</button>
				) : (
					<button
						type="submit"
						disabled={!input.trim()}
						aria-label="Send"
						className="flex w-10 items-center justify-center rounded-xl bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-40"
					>
						<Send aria-hidden className="h-4 w-4" />
					</button>
				)}
			</form>
		</section>
	);
}
