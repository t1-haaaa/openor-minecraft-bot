export class ProviderNotSuitableError extends Error {
  constructor(provider: string, reason: string) {
    super(`Provider ${provider} unsuitable for 24/7: ${reason}`);
    this.name = "ProviderNotSuitableError";
  }
}

export class ResourceExhaustedError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ResourceExhaustedError";
  }
}

export class BotNotFoundError extends Error {
  constructor(botId: string) {
    super(`Bot ${botId} not found`);
    this.name = "BotNotFoundError";
  }
}
