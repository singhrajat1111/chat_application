import { useCallback, useEffect, useRef } from 'react';
import socketService from '../socket/socket';

const TYPING_TIMEOUT = 3000; // Stop typing after 3 seconds of inactivity

export const useTypingIndicator = (conversationId) => {
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const startTyping = useCallback(() => {
    if (!conversationId) return;

    if (!isTypingRef.current) {
      socketService.startTyping(conversationId);
      isTypingRef.current = true;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketService.stopTyping(conversationId);
      isTypingRef.current = false;
    }, TYPING_TIMEOUT);
  }, [conversationId]);

  const stopTyping = useCallback(() => {
    if (!conversationId) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (isTypingRef.current) {
      socketService.stopTyping(conversationId);
      isTypingRef.current = false;
    }
  }, [conversationId]);

  // Clean up on unmount or conversationId change
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current) {
        socketService.stopTyping(conversationId);
        isTypingRef.current = false;
      }
    };
  }, [conversationId]);

  return { startTyping, stopTyping };
};
