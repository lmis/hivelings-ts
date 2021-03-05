interface MockWebsocket {
  send: (data: string) => void;
  onmessage: (data: MessageEvent<string>) => void;
}
export const makeMockWebsocket = (
  createResponse: (data: string) => string
): MockWebsocket => {
  const socket: MockWebsocket = {
    onmessage: (_) => null,
    send: (data) => {
      socket.onmessage({ data: createResponse(data) } as any);
    }
  };

  return socket;
};
