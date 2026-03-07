const ackHandler = {
  pending: {},

  track(peerId, id) {
    this.pending[id] = { peerId, lastTry: Date.now() };
  },

  ack(peerId, id) {
    updateMessageStatus(peerId, id, "received");
    delete this.pending[id];
  },
};
