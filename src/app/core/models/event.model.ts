export interface EventMessage {
  body: string;
}

export interface PaintEvent {
  id: number;
  title: string;
  message: EventMessage;
  date: string;
  time: string;
  location: string;
  address: string;
  mapEmbedUrl: string;
  mapLink: string;
  acceptedMessage: string;
  rules: string[];
}

export interface PaintEventWithSeats extends PaintEvent {
  seatsAvailable: number;
  isSoldOut: boolean;
}
