
class Toolbar extends React.Component {
  handleLevelChange(e) {
    if(typeof this.props.onLevel !== 'function') return;
    var newLevel = parseInt(e.target.value, 10) || 15;
    this.props.onLevel(newLevel);
  }

  render() {

    var readerNodes = [];

    this.props.readers.forEach( (r) => {
      var onClick = (e) => this.props.onOpenDoor(r.name);
      <button key={r.name} className={r.state} onClick={onClick} />
    });

    return (
      <div id="buttons">
        <button className="right" onClick={this.props.onLogout}>Log Out</button>
        <button className="left" onClick={this.props.onNewCard}>Add Card</button>
        <span>Level:</span>
        <input type="number" min="2" max="15" onChange={this.handleLevelChange.bind(this)} value={this.props.level} />
        <span className="openBtns">
          {readerNodes}
        </span>
      </div>
    );
  }
}

if(!window.DoorEntry) window.DoorEntry = {};
window.DoorEntry.Toolbar = Toolbar;