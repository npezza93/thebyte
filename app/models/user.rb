class User < ActiveRecord::Base
	validates :username, presence: true, uniqueness: true
      has_many :comments, dependent: :delete_all
	validates :email, presence: true
  	has_secure_password
  	validates :password, length: { minimum: 6 }, if: Proc.new { |a| !(a.password.blank?) }
  	mount_uploader :image, AvatarUploader

  	def send_password_reset
  		generate_token(:password_reset_token)
  		self.password_reset_sent_at = Time.zone.now
  		save!(:validate => false)
  		UserMailer.password_reset(self).deliver
  	end

  	def generate_token(column)
  		begin 
  			self[column]=SecureRandom.urlsafe_base64
  		end while User.exists?(column => self[column])  		
  	end
end