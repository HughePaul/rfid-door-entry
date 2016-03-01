


class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      cards: this.props.cards || {},
      logs: this.props.logs || [],
      selectedCardId: null,
    };
  }

  handleNewCard() {
    this.setState({ selectedCardId: '' });    
  }

  handleSelectCard(id) {
    if(!this.state.cards[id]) return;
    this.setState({ selectedCardId: id });    
  }

  handleSaveCard(id, card) {
    // update local state
    this.updateCard(id, card);
    // send to server
    window.socket.emit('card', id || card.id, card);
  }

  handleDeleteCard(id) {
    if(!window.confirm('Are you sure you want to remove this card?')) return;
    // update local state
    this.deleteCard(id);
    // send to server
    window.socket.emit('card', id);
  }

  setCards(cards) {
    var newSelectedCardId = this.state.selectedCardId;
    if(newSelectedCardId && !cards[newSelectedCardId]) newSelectedCardId = null;
    this.setState({ cards: cards, selectedCardId: newSelectedCardId });
  }

  updateCard(id, card) {

    // update clone of cards state object
    var newCards = Object.assign({}, this.state.cards);
    newCards[id || card.id] = card;

    var newState = {
      cards: newCards
    };

    // update selected card id to new card id
    if(this.state.selectedCardId === id) newState.selectedCardId = card.id;

    this.setState(newState);
  }

  deleteCard(id) {
    // delete card from clone of cards object
    var newCards = Object.assign({}, this.state.cards);
    delete newCards[id];

    var newState = {
      cards: newCards
    };
    // select no card if this card was selected
    if(this.state.selectedCardId === id) newState.selectedCardId = null; 
    this.setState(newState);
  }

  translateLog(log) {
    // try to decode embeded card json
    if (log.type === 'ADDED' || log.type === 'UPDATED' || log.type === 'REMOVED') {
      try {
        var jsonCard = JSON.parse(item.desc);
        if (jsonCard) {
          log.card = jsonCard;
          log.card.level = log.level || log.card.level || '?';
        }
      } catch (e) { }
      if(!log.card) {
        log.card = {
          name: 'UNKNOWN',
          id: log.cardid || '?',
          level: log.level || '?'
        };
      }
    }
    return log;
  }

  setLogs(logs) {
    logs = logs.map( this.translateLog ).reverse();
    this.setState({ logs: logs });
  }

  addLog(log) {
    log = this.translateLog(log);
    var newState = {
      logs: React.addons.update(this.state.logs, {$unshift: [log]})
    };
    this.setState(newState);
  }

  render() {
    var selectedCard = this.state.cards[this.state.selectedCardId];
    if(this.state.selectedCardId === '') {
      selectedCard = {
        name: 'New Card',
        id: '',
        notes: '',
        avatar: '',
        pattern: '################################################',
        level: this.state.level || 5
      };
    }

    return (
      <section className="app">
        <DoorEntry.CardList
          cards={this.state.cards}
          selectedCardId={this.state.selectedCardId}
          onSelectCard={this.handleSelectCard.bind(this)} />
        <DoorEntry.CardDetails
          card={selectedCard}
          onSaveCard={this.handleSaveCard.bind(this)}
          onDeleteCard={this.handleDeleteCard.bind(this)} />
        <DoorEntry.LogList
          logs={this.state.logs}
          cards={this.state.cards}
          onSelectCard={this.handleSelectCard.bind(this)} />
      </section>
    );
  }
}

window.app = ReactDOM.render(
  <App />,
  document.getElementById('doorapp')
);


