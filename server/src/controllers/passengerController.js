const { getDatabase } = require('../models/database');
const Passenger = require('../models/Passenger');

class PassengerController {
  constructor() {
    this.dbManager = getDatabase(); 
    this.passenger = new Passenger(this.dbManager.db);
  }

  async createPassenger(req, res) {
  try {
    // Validate input
    const errors = this.passenger.validateData(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // Create passenger (synchronous operation)
    const newPassenger = this.passenger.create(req.body);
    
    // Return success response
    return res.status(201).json({ 
      success: true, 
      data: newPassenger 
    });

  } catch (error) {
    console.error('Error creating passenger:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

  async getPassenger(req, res) {
    try {
      const passenger = this.passenger.getById(req.params.id);
      if (!passenger) {
        return res.status(404).json({ success: false, error: 'Passenger not found' });
      }
      res.json({ success: true, data: passenger });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getAllPassengers(req, res) {
    try {
      const filters = {
        routeId: req.query.routeId,
        ministry: req.query.ministry,
        boardingArea: req.query.boardingArea,
        balanceStatus: req.query.balanceStatus,
        search: req.query.search,
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset) : undefined
      };

      const passengers = this.passenger.getAll(filters);
      res.json({ success: true, data: passengers });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updatePassenger(req, res) {
    try {
      const updatedPassenger = this.passenger.update(req.params.id, req.body);
      res.json({ success: true, data: updatedPassenger });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async deletePassenger(req, res) {
    try {
      const result = this.passenger.delete(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async deductFare(req, res) {
    try {
      const { fareAmount, conductorId, routeId } = req.body;
      
      // Validate required fields
      if (!fareAmount || typeof fareAmount !== 'number' || fareAmount <= 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid fareAmount: must be a positive number' 
        });
      }

      // Use conductorId and routeId from request body OR fallback to user context
      const finalConductorId = conductorId || (req.user ? req.user.conductor_id : null);
      const finalRouteId = routeId || (req.user ? req.user.assigned_route_id : null);
      
      console.log('Deduct fare request:', {
        passengerId: req.params.id,
        fareAmount,
        conductorId: finalConductorId,
        routeId: finalRouteId
      });

      const passenger = this.passenger.deductFare(
        req.params.id,
        fareAmount,
        finalConductorId,
        finalRouteId
      );
      
      res.json({ success: true, data: passenger });
    } catch (error) {
      console.error('Error deducting fare:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to deduct fare'
      });
    }
  }

  async addBalance(req, res) {
    try {
      const { amount, notes, conductorId, routeId } = req.body;

      // Validate required fields
      if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid amount: must be a positive number' 
        });
      }

      // Use conductorId and routeId from request body OR fallback to user context
      const finalConductorId = conductorId || (req.user ? req.user.conductor_id : null);
      const finalRouteId = routeId || (req.user ? req.user.assigned_route_id : null);
      
      console.log('Add balance request:', {
        passengerId: req.params.id,
        amount,
        conductorId: finalConductorId,
        routeId: finalRouteId,
        notes
      });

      const passenger = this.passenger.addBalance(
        req.params.id,
        amount,
        finalConductorId,
        finalRouteId,
        notes
      );
      
      res.json({ success: true, data: passenger });
    } catch (error) {
      console.error('Error adding balance:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to add balance'
      });
    }
  }

  async updateBalance(req, res) {
    try {
      const { newBalance, reason, conductorId, routeId } = req.body;

      // Validate required fields
      if (typeof newBalance !== 'number' || newBalance < 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid balance: must be a positive number or zero' 
        });
      }

      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Reason is required for balance adjustments' 
        });
      }

      // Use conductorId and routeId from request body OR fallback to user context
      const finalConductorId = conductorId || (req.user ? req.user.conductor_id : null);
      const finalRouteId = routeId || (req.user ? req.user.assigned_route_id : null);
      
      console.log('Update balance request:', {
        passengerId: req.params.id,
        newBalance,
        conductorId: finalConductorId,
        routeId: finalRouteId,
        reason
      });

      const passenger = await this.passenger.updateBalance(
        req.params.id,
        newBalance,
        finalConductorId,
        finalRouteId,
        reason
      );
      
      res.json({ success: true, data: passenger });
    } catch (error) {
      console.error('Error updating balance:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update balance'
      });
    }
  }

  async transferToRoute(req, res) {
    try {
      const { newRouteId, conductorId } = req.body;
      
      // Use conductorId from request body OR fallback to user context
      const finalConductorId = conductorId || (req.user ? req.user.conductor_id : null);
      
      const passenger = this.passenger.transferToRoute(
        req.params.id,
        newRouteId,
        finalConductorId
      );
      res.json({ success: true, data: passenger });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getPassengerTransactions(req, res) {
    try {
      const transactions = this.passenger.getTransactionHistory(
        req.params.id,
        req.query.limit
      );
      res.json({ success: true, data: transactions });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

const passengerController = new PassengerController();

module.exports = {
  createPassenger: passengerController.createPassenger.bind(passengerController),
  getPassenger: passengerController.getPassenger.bind(passengerController),
  getAllPassengers: passengerController.getAllPassengers.bind(passengerController),
  updatePassenger: passengerController.updatePassenger.bind(passengerController),
  deletePassenger: passengerController.deletePassenger.bind(passengerController),
  deductFare: passengerController.deductFare.bind(passengerController),
  addBalance: passengerController.addBalance.bind(passengerController),
  updateBalance: passengerController.updateBalance.bind(passengerController),
  transferToRoute: passengerController.transferToRoute.bind(passengerController),
  getPassengerTransactions: passengerController.getPassengerTransactions.bind(passengerController)
};