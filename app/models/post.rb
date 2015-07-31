class Post < ActiveRecord::Base
	extend FriendlyId
	friendly_id :title, use: :slugged
	mount_uploader :image, ImageUploader
	has_many :comments
end
