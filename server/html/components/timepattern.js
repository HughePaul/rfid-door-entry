
class TimePattern extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      currentHalfHour: 0,
      pattern: this.props.pattern,      
      mouseDown: false,
      turnOn: true
    };
  }

  componentWillReceiveProps(nextProps) {
    this.setState({pattern: nextProps.pattern || ''});
  }

  componentDidMount() {
    this.updateCurrentTime();
    this.updateTimer = setInterval(this.updateCurrentTime.bind(this), 60000);
  }

  componentWillUnmount() {
    clearTimer(this.updateTimer);
  }

  updateCurrentTime() {
    var now = new Date();
    var halfHour = (now.getHours() * 2) + (now.getMinutes() >= 30 ? 1 : 0);
    this.setState({currentHalfHour: halfHour});
  }

  handleMouse(e, halfHour) {
    if(!e.buttons) return this.handleMouseOff(e);

    e.preventDefault();

    var newState = {};

    if(!this.state.mouseDown) {
      newState.mouseDown = true;
      newState.turnOn = !e.target.checked;
    } else {
      newState.turnOn = this.state.turnOn;
    }

    newState.pattern =  
      this.state.pattern.substr(0, halfHour) +
      (newState.turnOn ? '#' : '-') +
      this.state.pattern.substr(halfHour + 1);

    if(newState.pattern === this.state.pattern) return;

    this.setState(newState);
    this.props.onChange(newState.pattern);
  }

  handleMouseOff(e) {
    e.preventDefault();
    if(!this.state.mouseDown) return;
    this.setState({ mouseDown: false });
  }

  render() {

    var nodesHours = [];
    for(let hour = 0; hour < 12; hour++) {
      nodesHours.push(
        <th key={hour} colSpan="2">{hour ? hour : 12}</th>
      );
    }

    var nodesAM = [];
    var nodesPM = [];
    for(var i = 0; i < 48; i++) {
      let halfHour = i;
      let handler = (e) => this.handleMouse(e, halfHour);
      let node =
        <td key={halfHour}>
          <input
            className={halfHour === this.state.currentHalfHour ? 'currentHour': ''}
            type="checkbox"
            disabled={!this.props.enabled}
            checked={this.state.pattern.substr(halfHour, 1) === '#'}
            onMouseDown={handler}
            onMouseMove={handler}
            onMouseUp={this.handleMouseOff.bind(this)}
          />
        </td>;
      if(halfHour < 24) nodesAM.push(node); else nodesPM.push(node);
    }

    return (
      <table className="cardPattern">
      <tbody>
        <tr>
          {nodesHours}
        </tr>
        <tr>
          <th>AM</th>
          {nodesAM}
        </tr>
        <tr>
          <th>PM</th>
          {nodesPM}
        </tr>
        </tbody>
      </table>
    );
  }
}

if(!window.DoorEntry) window.DoorEntry = {};
window.DoorEntry.TimePattern = TimePattern;