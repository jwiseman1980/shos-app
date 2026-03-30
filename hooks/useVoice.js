"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Voice interface hook — Web Speech API for STT, SpeechSynthesis for TTS.
 *
 * Returns:
 *   listening     — mic is active
 *   speaking      — TTS is reading aloud
 *   voiceMode     — auto-read assistant responses
 *   transcript    — current interim transcript
 *   supported     — browser supports speech recognition
 *   startListening / stopListening — mic controls
 *   speak / stopSpeaking — TTS controls
 *   toggleVoiceMode — toggle auto-read
 */
export default function useVoice({ onFinalTranscript, onInterimTranscript } = {}) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(false);

  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

  // Check browser support on mount
  useEffect(() => {
    const SpeechRecognition =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    setSupported(!!SpeechRecognition);

    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // Stop any active TTS
    if (synthRef.current?.speaking) {
      synthRef.current.cancel();
      setSpeaking(false);
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalAccum = "";

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }

      if (final) {
        finalAccum += final;
        setTranscript(finalAccum);
        onInterimTranscript?.(finalAccum);
      } else if (interim) {
        setTranscript(finalAccum + interim);
        onInterimTranscript?.(finalAccum + interim);
      }
    };

    recognition.onend = () => {
      setListening(false);
      if (finalAccum.trim()) {
        onFinalTranscript?.(finalAccum.trim());
      }
      setTranscript("");
    };

    recognition.onerror = (event) => {
      // "no-speech" and "aborted" are normal — user just didn't say anything
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("Speech recognition error:", event.error);
      }
      setListening(false);
      setTranscript("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setTranscript("");
  }, [onFinalTranscript, onInterimTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  const speak = useCallback((text) => {
    if (!synthRef.current) return;

    // Strip markdown formatting for cleaner speech
    const clean = text
      .replace(/#{1,6}\s/g, "")           // headings
      .replace(/\*\*([^*]+)\*\*/g, "$1")  // bold
      .replace(/\*([^*]+)\*/g, "$1")      // italic
      .replace(/`[^`]+`/g, "")            // inline code
      .replace(/```[\s\S]*?```/g, "")     // code blocks
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
      .replace(/[-*] /g, "")              // list markers
      .replace(/\n{2,}/g, ". ")           // paragraph breaks
      .replace(/\n/g, ". ")               // line breaks
      .replace(/\s{2,}/g, " ")            // extra spaces
      .trim();

    if (!clean) return;

    // Chrome has a ~15s limit per utterance — split long text
    const chunks = splitIntoChunks(clean, 200);
    let index = 0;

    function speakNext() {
      if (index >= chunks.length) {
        setSpeaking(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.onend = () => {
        index++;
        speakNext();
      };
      utterance.onerror = () => {
        setSpeaking(false);
      };
      synthRef.current.speak(utterance);
    }

    synthRef.current.cancel();
    setSpeaking(true);
    speakNext();
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setSpeaking(false);
  }, []);

  const toggleVoiceMode = useCallback(() => {
    setVoiceMode((v) => !v);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  return {
    listening,
    speaking,
    voiceMode,
    transcript,
    supported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    toggleVoiceMode,
  };
}

/** Split text into chunks at sentence boundaries, max ~charLimit chars each */
function splitIntoChunks(text, charLimit) {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks = [];
  let current = "";

  for (const s of sentences) {
    if ((current + s).length > charLimit && current) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
